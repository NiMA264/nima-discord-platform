const fs = require('fs');
const path = require('path');
const { loadExceptionRegistry, findException, isExpired } = require('./lib/exceptionRegistry');

const ROOT = process.cwd();
const TRANSITION_DIR = path.join(ROOT, 'docs', 'transition');
const CSV_FILES = [
    'jira-transition-backlog-external-keys.csv',
    'jira-phase3-parent-id-template.csv',
    'linear-transition-backlog.csv',
    'jira-transition-backlog.csv'
];
const UNIQUE_KEY_CANONICAL_FILES = new Set([
    'jira-transition-backlog-external-keys.csv'
]);

const ALLOWED_MIGRATION_PHASES = new Set([
    'MIGRATION_PHASE=A',
    'MIGRATION_PHASE=B',
    'MIGRATION_PHASE=C',
    'MIGRATION_PHASE=D'
]);

const RISK_SCORE_MAP = {
    P0: 'CRITICAL',
    P1: 'HIGH',
    P2: 'MEDIUM',
    P3: 'LOW'
};

function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
            continue;
        }

        cur += ch;
    }

    out.push(cur);
    return out;
}

function parseCsv(content) {
    const text = content.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }

    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i += 1) {
        const cols = parseCsvLine(lines[i]);
        const rec = {};
        for (let c = 0; c < headers.length; c += 1) {
            rec[headers[c]] = (cols[c] || '').trim();
        }
        rows.push({
            line: i + 1,
            record: rec
        });
    }

    return { headers, rows };
}

function boolYes(value) {
    const v = String(value || '').trim().toLowerCase();
    return v === 'yes' || v === 'true';
}

function getExternalKey(record) {
    return record['External Key'] || '';
}

function getValue(record, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return String(record[key] || '').trim();
        }
    }
    return '';
}

function pushError(errors, { file, line, externalKey, ruleId, message }) {
    errors.push({
        file,
        line,
        externalKey: externalKey || 'N/A',
        ruleId,
        message
    });
}

function pushWarning(warnings, { file, line, externalKey, ruleId, message }) {
    warnings.push({
        file,
        line,
        externalKey: externalKey || 'N/A',
        ruleId,
        message
    });
}

function handleExceptionAwareViolation({
    errors,
    warnings,
    exceptions,
    file,
    line,
    externalKey,
    ruleId,
    message
}) {
    const exceptionPath = `docs/transition/${file}`;
    const exception = findException(exceptions, ruleId, exceptionPath);
    if (!exception) {
        pushError(errors, {
            file,
            line,
            externalKey,
            ruleId: 'TRANSITION-EXC-001',
            message: `Unregistered exception for ${ruleId} at ${exceptionPath}: ${message}`
        });
        return;
    }
    if (isExpired(exception)) {
        pushError(errors, {
            file,
            line,
            externalKey,
            ruleId: 'TRANSITION-EXC-002',
            message: `Expired exception for ${ruleId} at ${exceptionPath}: ${message}`
        });
        return;
    }
    pushWarning(warnings, {
        file,
        line,
        externalKey,
        ruleId,
        message: `Approved temporary exception (owner=${exception.owner}, expires_at=${exception.expires_at}) ${message}`
    });
}

function main() {
    const parsedFiles = [];
    const errors = [];
    const warnings = [];
    const keyLocations = new Map();
    const { entries: exceptions, errors: registryErrors } = loadExceptionRegistry();

    for (const err of registryErrors) {
        pushError(errors, { ...err, externalKey: 'N/A' });
    }

    for (const file of CSV_FILES) {
        const fullPath = path.join(TRANSITION_DIR, file);
        if (!fs.existsSync(fullPath)) {
            pushError(errors, {
                file,
                line: 0,
                externalKey: 'N/A',
                ruleId: 'TRANSITION-000',
                message: 'Required CSV file is missing'
            });
            continue;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseCsv(content);
        parsedFiles.push({ file, ...parsed });

        for (const row of parsed.rows) {
            const extKey = getExternalKey(row.record);
            if (!extKey) continue;
            if (!UNIQUE_KEY_CANONICAL_FILES.has(file)) continue;
            if (!keyLocations.has(extKey)) {
                keyLocations.set(extKey, []);
            }
            keyLocations.get(extKey).push({ file, line: row.line });
        }
    }

    // TRANSITION-001 External Key must be unique
    for (const [extKey, locations] of keyLocations.entries()) {
        if (locations.length <= 1) continue;
        for (const loc of locations) {
            pushError(errors, {
                file: loc.file,
                line: loc.line,
                externalKey: extKey,
                ruleId: 'TRANSITION-001',
                message: `External Key must be unique; duplicates found (${locations.length})`
            });
        }
    }

    const allKeys = new Set(keyLocations.keys());

    for (const parsed of parsedFiles) {
        const { file, rows } = parsed;

        for (const row of rows) {
            const rec = row.record;
            const extKey = getExternalKey(rec);

            // TRANSITION-006 Parent reference must exist
            const parentExtKey = getValue(rec, 'Parent External Key');
            if (parentExtKey && !allKeys.has(parentExtKey)) {
                pushError(errors, {
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-006',
                    message: `Parent External Key not found: ${parentExtKey}`
                });
            }

            // TRANSITION-002 Risk and Change Risk Score mismatch
            const risk = getValue(rec, 'Risk', 'Risk (P0-P3)');
            const changeRisk = getValue(rec, 'Change Risk Score');
            if (risk && changeRisk && RISK_SCORE_MAP[risk] && RISK_SCORE_MAP[risk] !== changeRisk) {
                pushError(errors, {
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-002',
                    message: `Risk ${risk} requires Change Risk Score ${RISK_SCORE_MAP[risk]}, got ${changeRisk}`
                });
            }

            // TRANSITION-007 Migration phase must be A-D
            const migrationPhase = getValue(rec, 'Migration Phase', 'Migration Phase (A-D)');
            if (migrationPhase && !ALLOWED_MIGRATION_PHASES.has(migrationPhase)) {
                pushError(errors, {
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-007',
                    message: `Invalid Migration Phase value: ${migrationPhase}`
                });
            }

            // TRANSITION-003 Missing Constraint Test ID (exception-aware)
            const constraintRequired = boolYes(getValue(rec, 'Constraint Test Required'));
            const constraintTestId = getValue(rec, 'Constraint Test ID');
            if (constraintRequired && !constraintTestId) {
                handleExceptionAwareViolation({
                    errors,
                    warnings,
                    exceptions,
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-003',
                    message: 'Constraint Test Required=Yes but Constraint Test ID is missing'
                });
            }

            // TRANSITION-004 Missing Approval Owner (exception-aware)
            const securityReviewRequired = boolYes(getValue(rec, 'Security Review Required'));
            const approvalOwner = getValue(rec, 'Approval Owner');
            if (securityReviewRequired && !approvalOwner) {
                handleExceptionAwareViolation({
                    errors,
                    warnings,
                    exceptions,
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-004',
                    message: 'Security Review Required=Yes but Approval Owner is missing'
                });
            }

            // TRANSITION-005 Audit items require Runbook Required=Yes (exception-aware)
            const auditRequired = boolYes(getValue(rec, 'Audit Requirement'));
            const runbookRequired = boolYes(getValue(rec, 'Runbook Required'));
            if (auditRequired && !runbookRequired) {
                handleExceptionAwareViolation({
                    errors,
                    warnings,
                    exceptions,
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-005',
                    message: 'Audit Requirement=Yes requires Runbook Required=Yes'
                });
            }

            // TRANSITION-008 Rollback verification policy for migration rows
            const rollbackVerified = getValue(rec, 'Rollback Verified').toLowerCase();
            const isMigrationRow = Boolean(migrationPhase);
            if (isMigrationRow && rollbackVerified !== 'true' && rollbackVerified !== 'false') {
                pushError(errors, {
                    file,
                    line: row.line,
                    externalKey: extKey,
                    ruleId: 'TRANSITION-008',
                    message: 'Rollback Verified must be true/false for migration-scoped rows'
                });
            }
        }
    }

    for (const warn of warnings) {
        console.warn(`${warn.file}:${warn.line} [${warn.externalKey}] ${warn.ruleId} ${warn.message}`);
    }

    if (errors.length > 0) {
        for (const err of errors) {
            console.error(
                `${err.file}:${err.line} [${err.externalKey}] ${err.ruleId} ${err.message}`
            );
        }
        console.error(`\nTransition lint failed with ${errors.length} error(s).`);
        process.exit(1);
    }

    console.log(`Transition lint passed with 0 errors${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
}

main();

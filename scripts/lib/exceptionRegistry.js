const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'docs', 'governance', 'exceptions.yaml');

function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function parseYamlList(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    const entries = [];
    let current = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        if (line === 'exceptions:') continue;

        if (line.startsWith('- ')) {
            if (current) entries.push(current);
            current = {};
            const rest = line.slice(2).trim();
            if (rest) {
                const idx = rest.indexOf(':');
                if (idx > 0) {
                    const key = rest.slice(0, idx).trim();
                    const value = rest.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
                    current[key] = value;
                }
            }
            continue;
        }

        if (!current) continue;
        const idx = line.indexOf(':');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
        current[key] = value;
    }

    if (current) entries.push(current);
    return entries;
}

function loadExceptionRegistry() {
    if (!fs.existsSync(REGISTRY_PATH)) {
        return { entries: [], errors: [{ ruleId: 'EXCEPTION-000', file: 'docs/governance/exceptions.yaml', line: 0, message: 'Missing exception registry file' }] };
    }

    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const entries = parseYamlList(raw);
    const errors = [];

    for (const e of entries) {
        const key = `${e.rule_id || 'N/A'}@${e.path || 'N/A'}`;
        if (!e.rule_id) {
            errors.push({ ruleId: 'EXCEPTION-001', file: 'docs/governance/exceptions.yaml', line: 0, message: `Missing rule_id (${key})` });
        }
        if (!e.path) {
            errors.push({ ruleId: 'EXCEPTION-002', file: 'docs/governance/exceptions.yaml', line: 0, message: `Missing path (${key})` });
        }
        if (!e.owner || /tbd/i.test(e.owner)) {
            errors.push({ ruleId: 'EXCEPTION-003', file: 'docs/governance/exceptions.yaml', line: 0, message: `Invalid owner (${key}); owner must be set and not TBD` });
        }
        if (!e.created_at || !isIsoDate(e.created_at)) {
            errors.push({ ruleId: 'EXCEPTION-004', file: 'docs/governance/exceptions.yaml', line: 0, message: `Invalid created_at (${key}); expected YYYY-MM-DD` });
        }
        if (!e.expires_at || !isIsoDate(e.expires_at)) {
            errors.push({ ruleId: 'EXCEPTION-005', file: 'docs/governance/exceptions.yaml', line: 0, message: `Invalid expires_at (${key}); expected YYYY-MM-DD` });
        }
        if (!e.removal_condition || !String(e.removal_condition).trim()) {
            errors.push({ ruleId: 'EXCEPTION-006', file: 'docs/governance/exceptions.yaml', line: 0, message: `Missing removal_condition (${key})` });
        }
    }

    return { entries, errors };
}

function findException(entries, ruleId, relPath) {
    return entries.find(e => e.rule_id === ruleId && e.path === relPath) || null;
}

function isExpired(entry) {
    const now = new Date();
    const exp = new Date(`${entry.expires_at}T00:00:00Z`);
    return Number.isFinite(exp.getTime()) ? now > exp : true;
}

module.exports = {
    loadExceptionRegistry,
    findException,
    isExpired
};

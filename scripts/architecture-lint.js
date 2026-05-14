const fs = require('fs');
const path = require('path');
const { loadExceptionRegistry, findException, isExpired } = require('./lib/exceptionRegistry');

const ROOT = process.cwd();

function walkFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            out.push(full);
        }
    }
    return out;
}

function toRel(file) {
    return path.relative(ROOT, file).replace(/\\/g, '/');
}

function findLine(content, pattern) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
        if (pattern.test(lines[i])) return i + 1;
    }
    return 1;
}

function addError(errors, { ruleId, file, line, message }) {
    errors.push({ ruleId, file, line, message });
}

function addWarning(warnings, { ruleId, file, line, message }) {
    warnings.push({ ruleId, file, line, message });
}

function ruleArch001ProjectionNoExternalProviders(errors) {
    const projectionFiles = walkFiles(path.join(ROOT, 'src', 'projections'));
    const forbidden = [
        /require\(['"]openai['"]\)/,
        /require\(['"]discord\.js['"]\)/,
        /require\(['"]https?['"]\)/,
        /require\(['"]undici['"]\)/,
        /require\(['"].*integrations\/github.*['"]\)/,
        /\bfetch\s*\(/
    ];

    for (const file of projectionFiles) {
        const rel = toRel(file);
        const content = fs.readFileSync(file, 'utf8');
        for (const re of forbidden) {
            if (!re.test(content)) continue;
            addError(errors, {
                ruleId: 'ARCH-001',
                file: rel,
                line: findLine(content, re),
                message: 'Projections must not call external providers or network APIs'
            });
        }
    }
}

function ruleArch002DashboardNoDbDirectAccess(errors, warnings, exceptions) {
    const dashboardFiles = walkFiles(path.join(ROOT, 'dashboard', 'src'));
    const forbidden = [
        /@prisma\/client/,
        /better-sqlite3/,
        /src\/database\//,
        /src\/repositories\//,
        /lib\/prisma/,
        /prisma/
    ];

    for (const file of dashboardFiles) {
        const rel = toRel(file);
        const content = fs.readFileSync(file, 'utf8');
        for (const re of forbidden) {
            if (!re.test(content)) continue;
            const line = findLine(content, re);
            const exception = findException(exceptions, 'ARCH-002', rel);
            if (exception) {
                if (isExpired(exception)) {
                    addError(errors, {
                        ruleId: 'ARCH-EXC-002',
                        file: rel,
                        line,
                        message: 'Exception is expired for rule ARCH-002'
                    });
                } else {
                    addWarning(warnings, {
                        ruleId: 'ARCH-002',
                        file: rel,
                        line,
                        message: `Approved temporary exception (owner=${exception.owner}, expires_at=${exception.expires_at})`
                    });
                }
            } else {
                addError(errors, {
                    ruleId: 'ARCH-EXC-001',
                    file: rel,
                    line,
                    message: 'Unregistered architecture exception: ARCH-002 requires exception registry entry (rule_id+path)'
                });
            }
        }
    }
}

function ruleArch003ReadModelsFromDomainEvents(errors) {
    const requiredEventSourceFiles = [
        path.join(ROOT, 'src', 'repositories', 'activityInsightsRepository.js'),
        path.join(ROOT, 'src', 'repositories', 'githubInsightsRepository.js'),
        path.join(ROOT, 'src', 'repositories', 'workflowSuggestionRepository.js')
    ];

    for (const file of requiredEventSourceFiles) {
        if (!fs.existsSync(file)) continue;
        const rel = toRel(file);
        const content = fs.readFileSync(file, 'utf8');
        const hasDomainEvents = /domainEventRepository/.test(content);
        if (!hasDomainEvents) {
            addError(errors, {
                ruleId: 'ARCH-003',
                file: rel,
                line: 1,
                message: 'Read-model repository must source from domain_events (domainEventRepository)'
            });
        }
    }
}

function ruleArch004WebhookNoProjectionLogic(errors) {
    const webhookDirs = [
        path.join(ROOT, 'src', 'api', 'github'),
        path.join(ROOT, 'src', 'integrations', 'github')
    ];
    const forbidden = [
        /projections\//,
        /projection/i,
        /runProjection/,
        /replayProjection/
    ];

    for (const dir of webhookDirs) {
        const files = walkFiles(dir);
        for (const file of files) {
            const rel = toRel(file);
            const content = fs.readFileSync(file, 'utf8');
            for (const re of forbidden) {
                if (!re.test(content)) continue;
                addError(errors, {
                    ruleId: 'ARCH-004',
                    file: rel,
                    line: findLine(content, re),
                    message: 'Webhook runtime must not contain projection logic or projection imports'
                });
            }
        }
    }
}

function ruleArch005DeterministicCoreProviders(errors) {
    const coreFiles = [
        path.join(ROOT, 'src', 'repositories', 'domainEventRepository.js'),
        path.join(ROOT, 'src', 'repositories', 'taskRepository.js'),
        path.join(ROOT, 'src', 'repositories', 'sprintRepository.js'),
        path.join(ROOT, 'src', 'services', 'projectService.js')
    ];
    const forbidden = [
        /crypto\.randomUUID\s*\(/,
        /new Date\s*\(/,
        /\bDate\.now\s*\(/
    ];

    for (const file of coreFiles) {
        if (!fs.existsSync(file)) continue;
        const rel = toRel(file);
        const content = fs.readFileSync(file, 'utf8');
        for (const re of forbidden) {
            if (!re.test(content)) continue;
            addError(errors, {
                ruleId: 'ARCH-005',
                file: rel,
                line: findLine(content, re),
                message: 'Core event/task/project paths must use clock/uuid providers (no direct Date/randomUUID)'
            });
        }
    }
}

function main() {
    const errors = [];
    const warnings = [];
    const { entries: exceptions, errors: registryErrors } = loadExceptionRegistry();

    for (const err of registryErrors) {
        addError(errors, err);
    }

    ruleArch001ProjectionNoExternalProviders(errors);
    ruleArch002DashboardNoDbDirectAccess(errors, warnings, exceptions);
    ruleArch003ReadModelsFromDomainEvents(errors);
    ruleArch004WebhookNoProjectionLogic(errors);
    ruleArch005DeterministicCoreProviders(errors);

    for (const warn of warnings) {
        // keep warnings explicit but non-blocking
        console.warn(`${warn.file}:${warn.line} [${warn.ruleId}] ${warn.message}`);
    }

    if (errors.length > 0) {
        for (const err of errors) {
            console.error(`${err.file}:${err.line} [${err.ruleId}] ${err.message}`);
        }
        console.error(`\nArchitecture lint failed with ${errors.length} error(s).`);
        process.exit(1);
    }

    console.log(`Architecture lint passed with 0 errors${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
}

main();

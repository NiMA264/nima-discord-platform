const fs = require('fs');
const path = require('path');
const { validateEventEnvelope } = require('../src/domain/events/eventEnvelopeSchema');

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'src', 'domain', 'events', 'fixtures', 'v1');

function walkJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkJsonFiles(full));
        else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
    return out;
}

function toRel(file) {
    return path.relative(ROOT, file).replace(/\\/g, '/');
}

function main() {
    const files = walkJsonFiles(FIXTURE_DIR);
    const errors = [];

    for (const file of files) {
        const rel = toRel(file);
        try {
            const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
            const result = validateEventEnvelope(payload);
            if (!result.valid) {
                for (const err of result.errors) {
                    errors.push(`${rel} [EVENT-ENV-001] ${err}`);
                }
            }
        } catch (err) {
            errors.push(`${rel} [EVENT-ENV-000] Invalid JSON: ${err.message}`);
        }
    }

    if (errors.length) {
        for (const err of errors) console.error(err);
        console.error(`\nEvent envelope lint failed with ${errors.length} error(s).`);
        process.exit(1);
    }

    console.log(`Event envelope lint passed with ${files.length} fixture file(s).`);
}

main();

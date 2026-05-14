import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const clock = require('../../src/lib/clock');
const uuidProvider = require('../../src/lib/uuidProvider');

export function setFixedNow(iso) {
    const fixed = new Date(iso);
    clock.setNowProvider(() => fixed);
}

export function setUuidSequence(values) {
    const queue = [...values];
    uuidProvider.setUuidProvider(() => {
        if (!queue.length) {
            throw new Error('uuid sequence exhausted');
        }
        return queue.shift();
    });
}

export function resetDeterminism() {
    clock.resetNowProvider();
    uuidProvider.resetUuidProvider();
}

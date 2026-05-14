import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const tempDir = path.join(rootDir, '.tmp', 'testdb');
fs.mkdirSync(tempDir, { recursive: true });

const workerId = String(process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID || 'w0');
const pid = String(process.pid);
const runId = String(process.env.VITEST_RUN_ID || Date.now());
const dbFile = path.join(tempDir, `nima-test-${runId}-${pid}-${workerId}.sqlite3`);

process.env.DATABASE_URL = `file:${dbFile}`;
process.env.DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || 'default-workspace';

function cleanupDbArtifacts(baseFile) {
    const candidates = [baseFile, `${baseFile}-shm`, `${baseFile}-wal`];
    for (const file of candidates) {
        try {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        } catch (_) {
            // best-effort cleanup for local test artifacts
        }
    }
}

process.on('exit', () => cleanupDbArtifacts(dbFile));

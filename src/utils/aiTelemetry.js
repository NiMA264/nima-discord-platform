const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'dev-optimize.jsonl');

async function logOptimizeTelemetry(data) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        const line = `${JSON.stringify(data)}\n`;
        await fs.promises.appendFile(LOG_FILE, line, 'utf8');
    } catch (err) {
        console.error('[AI_TELEMETRY] Failed to write optimize telemetry', err?.message || err);
    }
}

module.exports = {
    logOptimizeTelemetry
};

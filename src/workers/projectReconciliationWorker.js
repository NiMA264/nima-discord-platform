const { runProjectReconciliation } = require('../reconciliation/projectReconciliation');
const { info } = require('../utils/logger');
const { handleWorkerError } = require('../lib/handleWorkerError');
const metrics = require('../lib/metrics');

let timer;

async function reconcileGuild(guild) {
    const report = await runProjectReconciliation(guild);
    info('Project reconciliation report', {
        guildId: report.guildId,
        scannedProjects: report.scannedProjects,
        issueCount: report.issueCount,
        issueSummary: report.issueSummary
    });
    metrics.increment('worker_processed_total', 1, { worker: 'projectReconciliationWorker' });
    return report;
}

function startProjectReconciliationWorker(client) {
    if (timer) return;
    const intervalMs = Number(process.env.PROJECT_RECONCILIATION_INTERVAL_MS || 900000);

    timer = setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            try {
                await reconcileGuild(guild);
            } catch (err) {
                metrics.increment('worker_failure_total', 1, { worker: 'projectReconciliationWorker' });
                handleWorkerError('projectReconciliationWorker', err, { guildId: guild.id });
            }
        }
    }, intervalMs);
}

module.exports = {
    reconcileGuild,
    startProjectReconciliationWorker
};

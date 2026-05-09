const { runProjectReconciliation } = require('../reconciliation/projectReconciliation');
const { info, error } = require('../utils/logger');

let timer;

async function reconcileGuild(guild) {
    const report = await runProjectReconciliation(guild);
    info('Project reconciliation report', {
        guildId: report.guildId,
        scannedProjects: report.scannedProjects,
        issueCount: report.issueCount,
        issueSummary: report.issueSummary
    });
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
                error('Project reconciliation failed', { guildId: guild.id, error: err.message });
            }
        }
    }, intervalMs);
}

module.exports = {
    reconcileGuild,
    startProjectReconciliationWorker
};

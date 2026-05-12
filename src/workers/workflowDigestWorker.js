const workspaceService = require('../domain/workspace/workspaceService');
const aiWorkflowSuggestionService = require('../services/aiWorkflowSuggestionService');
const { buildWorkspaceDigest, formatWorkspaceDigestLog } = require('../services/workflowDigestService');
const { deliverWorkspaceDigest } = require('../services/discordDigestDeliveryService');
const { scoped } = require('../utils/logger');
const { handleWorkerError } = require('../lib/handleWorkerError');
const metrics = require('../lib/metrics');

const digestLogger = scoped('WORKFLOW_DIGEST');
const DAY_MS = 24 * 60 * 60 * 1000;

let timer;
const lastRun = new Map();

function dayKey(date) {
    return date.toISOString().slice(0, 10);
}

function shouldRunDaily(guildId, now) {
    const key = String(guildId || '');
    const today = dayKey(now);
    if (lastRun.get(key) === today) return false;
    lastRun.set(key, today);
    return true;
}

async function runWorkflowDigestCycleForGuild(guild, options = {}) {
    const guildId = String(guild?.id || '');
    if (!guildId) return 0;

    const now = options.now || new Date();
    const resolveWorkspaces = options.resolveWorkspaces || (() => workspaceService.listWorkspaces().map(item => item.workspaceId));
    const getSuggestions = options.getSuggestions || aiWorkflowSuggestionService.getWorkflowSuggestions;
    const deliver = options.deliver || deliverWorkspaceDigest;
    const log = options.log || (message => digestLogger.info('Workflow digest summary', { guildId, message, generatedAt: now.toISOString() }));

    if (!shouldRunDaily(guildId, now)) return 0;

    const workspaceIds = resolveWorkspaces();
    let emitted = 0;

    for (const workspaceId of workspaceIds) {
        try {
            const data = await getSuggestions({
                guildId,
                userId: 'system',
                workspaceId
            });
            const digest = buildWorkspaceDigest({
                workspaceId: data.workspaceId || workspaceId,
                suggestions: data.suggestions || []
            });
            if (digest.totalSuggestions === 0) continue;

            log(formatWorkspaceDigestLog(digest));
            const deliveryResult = await deliver({
                guildId,
                workspaceId: digest.workspaceId,
                digest
            });
            if (deliveryResult?.delivered) emitted += 1;
        } catch (err) {
            handleWorkerError('workflowDigestWorker', err, { guildId, workspaceId });
            metrics.increment('worker_failure_total', 1, { worker: 'workflowDigestWorker' });
        }
    }

    if (emitted > 0) {
        metrics.increment('worker_processed_total', emitted, { worker: 'workflowDigestWorker' });
    }

    return emitted;
}

function startWorkflowDigestWorker(client, options = {}) {
    if (timer) return;
    const intervalMs = Math.max(60 * 1000, Number(options.intervalMs || process.env.WORKFLOW_DIGEST_INTERVAL_MS || DAY_MS));

    timer = setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            await runWorkflowDigestCycleForGuild(guild, { now: new Date() });
        }
    }, intervalMs);
}

function resetWorkflowDigestWorkerState() {
    lastRun.clear();
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}

module.exports = {
    runWorkflowDigestCycleForGuild,
    startWorkflowDigestWorker,
    resetWorkflowDigestWorkerState
};

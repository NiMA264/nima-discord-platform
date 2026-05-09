const { claimQueuedEvents, markGithubEventProcessed } = require('../integrations/github/githubEventQueue');
const { createProjectLog } = require('../repositories/projectRepository');
const { info, error } = require('../utils/logger');

let timer;

async function processGithubEventsBatch(limit = 20) {
    const events = claimQueuedEvents(limit);

    for (const event of events) {
        try {
            const parsedPayload = JSON.parse(event.payload);
            const activity = parsedPayload?.activity;
            if (activity?.projectId) {
                await createProjectLog({
                    projectUid: activity.projectId,
                    source: 'GITHUB',
                    eventType: `github.${activity.type}`,
                    content: activity
                });
            }

            markGithubEventProcessed(event.id);
        } catch (err) {
            error('Failed to process github webhook event', { id: event.id, error: err.message });
        }
    }

    return events.length;
}

function startGithubEventWorker() {
    if (timer) return;

    const intervalMs = Number(process.env.GITHUB_WORKER_INTERVAL_MS || 3000);
    timer = setInterval(async () => {
        const count = await processGithubEventsBatch(20);
        if (count > 0) {
            info('GitHub webhook events processed', { count });
        }
    }, intervalMs);
}

module.exports = {
    startGithubEventWorker,
    processGithubEventsBatch
};

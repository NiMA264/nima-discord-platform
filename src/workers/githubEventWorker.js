const { claimQueuedEvents, markGithubEventProcessed } = require('../integrations/github/githubEventQueue');
const { createProjectLog } = require('../repositories/projectRepository');
const { info, error } = require('../utils/logger');

let timer;

function processGithubEventsBatch(limit = 20) {
    const events = claimQueuedEvents(limit);

    for (const event of events) {
        try {
            const parsedPayload = JSON.parse(event.payload);
            if (event.project_uid) {
                createProjectLog({
                    projectUid: event.project_uid,
                    source: 'GITHUB',
                    eventType: `github.${event.event_name}`,
                    content: parsedPayload
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
    timer = setInterval(() => {
        const count = processGithubEventsBatch(20);
        if (count > 0) {
            info('GitHub webhook events processed', { count });
        }
    }, intervalMs);
}

module.exports = {
    startGithubEventWorker,
    processGithubEventsBatch
};

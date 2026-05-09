const { createProjectLog } = require('../repositories/projectRepository');
const dbQueueAdapter = require('../queues/dbQueueAdapter');
const { QueueService } = require('../services/queueService');
const { info } = require('../utils/logger');
const { handleWorkerError } = require('../lib/handleWorkerError');

const queueService = new QueueService(dbQueueAdapter);

let timer;

async function processGithubEventsBatch(limit = 20) {
    const events = await queueService.dequeue('github_events', limit);

    for (const event of events) {
        try {
            const activity = event.payload?.activity;
            if (activity?.projectId) {
                await createProjectLog({
                    projectUid: activity.projectId,
                    source: 'GITHUB',
                    eventType: `github.${activity.type}`,
                    content: activity
                });
            }

            await queueService.ack('github_events', event.id);
        } catch (err) {
            await queueService.fail('github_events', event.id, err.message);
            handleWorkerError('githubEventWorker', err, { eventId: event.id });
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

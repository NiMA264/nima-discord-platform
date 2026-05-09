const { createProjectLog } = require('../repositories/projectRepository');
const dbQueueAdapter = require('../queues/dbQueueAdapter');
const { QueueService } = require('../services/queueService');
const { info } = require('../utils/logger');
const { handleWorkerError } = require('../lib/handleWorkerError');
const metrics = require('../lib/metrics');
const { notifyDomainEvent } = require('../services/notificationService');

const queueService = new QueueService(dbQueueAdapter);

let timer;

async function processGithubEventsBatch(limit = 20) {
    const events = await queueService.dequeue('github_events', limit);
    metrics.gauge('queue_depth_estimate', events.length, { queue: 'github_events' });

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

                await notifyDomainEvent('github.activity.received', {
                    projectId: activity.projectId,
                    type: activity.type,
                    summary: activity.summary,
                    url: activity.url,
                    actor: activity.actor,
                    occurredAt: activity.occurredAt
                });
            }

            await queueService.ack('github_events', event.id);
            metrics.increment('worker_processed_total', 1, { worker: 'githubEventWorker' });
        } catch (err) {
            await queueService.fail('github_events', event.id, err.message);
            metrics.increment('worker_failure_total', 1, { worker: 'githubEventWorker' });
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
        metrics.increment('worker_batch_total', 1, { worker: 'githubEventWorker' });
        if (count > 0) {
            info('GitHub webhook events processed', { count });
        }
    }, intervalMs);
}

module.exports = {
    startGithubEventWorker,
    processGithubEventsBatch
};

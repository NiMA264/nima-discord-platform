const crypto = require('crypto');
const { normalizeGithubEvent } = require('./normalizeGithubEvent');
const dbQueueAdapter = require('../../queues/dbQueueAdapter');
const { QueueService } = require('../../services/queueService');

const queueService = new QueueService(dbQueueAdapter);

function validateGithubSignature(secret, rawBody, signatureHeader) {
    if (!secret) return true;
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    const incoming = signatureHeader.replace('sha256=', '');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const incomingBuffer = Buffer.from(incoming, 'utf8');
    if (expectedBuffer.length !== incomingBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, incomingBuffer);
}

async function ingestGithubWebhook({ headers, rawBody, body }) {
    const eventName = headers['x-github-event'];
    if (!eventName) {
        return { ok: false, statusCode: 400, message: 'Missing x-github-event header' };
    }

    const signature = headers['x-hub-signature-256'];
    const isValid = validateGithubSignature(process.env.GITHUB_WEBHOOK_SECRET, rawBody, signature);
    if (!isValid) {
        return { ok: false, statusCode: 401, message: 'Invalid signature' };
    }

    const deliveryId = headers['x-github-delivery'];
    const activity = normalizeGithubEvent(eventName, body);
    if (!activity?.projectId) {
        return { ok: false, statusCode: 400, message: 'Missing project ID in event payload' };
    }

    await queueService.enqueue(
        'github_events',
        {
            activity,
            raw: body
        },
        {
            guildId: body?.guildId || null,
            projectId: activity.projectId,
            eventName,
            deliveryId
        }
    );

    return { ok: true, statusCode: 202, message: 'Event queued' };
}

module.exports = {
    ingestGithubWebhook
};

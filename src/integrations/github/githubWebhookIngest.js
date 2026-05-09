const crypto = require('crypto');
const { enqueueGithubEvent } = require('./githubEventQueue');
const { normalizeGithubEvent } = require('./normalizeGithubEvent');

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

function ingestGithubWebhook({ headers, rawBody, body }) {
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

    enqueueGithubEvent({
        guildId: body?.guildId || null,
        projectUid: activity.projectId,
        eventName,
        deliveryId,
        payload: {
            activity,
            raw: body
        }
    });

    return { ok: true, statusCode: 202, message: 'Event queued' };
}

module.exports = {
    ingestGithubWebhook
};

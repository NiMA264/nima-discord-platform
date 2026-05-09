const crypto = require('crypto');
const { enqueueGithubEvent } = require('./githubEventQueue');

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
    const guildId = body?.guildId || null;
    const projectUid = body?.projectId || body?.projectUid || null;

    enqueueGithubEvent({
        guildId,
        projectUid,
        eventName,
        deliveryId,
        payload: body
    });

    return { ok: true, statusCode: 202, message: 'Event queued' };
}

module.exports = {
    ingestGithubWebhook
};

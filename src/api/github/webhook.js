const { ingestGithubWebhookSignal } = require('../../integrations/github/githubWebhookService');

async function handleGithubWebhook({ headers = {}, rawBody = '', body = {} }) {
    const webhookSecret = String(process.env.GITHUB_WEBHOOK_SECRET || '');
    const result = await ingestGithubWebhookSignal({
        headers,
        rawBody,
        body,
        webhookSecret
    });

    return {
        statusCode: result.statusCode,
        body: {
            ok: result.ok,
            message: result.message,
            eventUid: result.eventUid || null
        }
    };
}

module.exports = {
    handleGithubWebhook
};

const http = require('http');
const { handleGithubWebhook } = require('../../api/github/webhook');
const { info, warn } = require('../../utils/logger');
const { handleWorkerError } = require('../../lib/handleWorkerError');

function startGithubWebhookServer() {
    const enabled = process.env.GITHUB_WEBHOOK_ENABLED === 'true';
    if (!enabled) return null;

    const port = Number(process.env.GITHUB_WEBHOOK_PORT || 8787);
    const server = http.createServer(async (req, res) => {
        if (req.method !== 'POST' || req.url !== '/github/webhook') {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));

        req.on('end', async () => {
            try {
                const rawBody = Buffer.concat(chunks).toString('utf8');
                const body = rawBody ? JSON.parse(rawBody) : {};
                const response = await handleGithubWebhook({
                    headers: req.headers,
                    rawBody,
                    body
                });

                res.statusCode = response.statusCode;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(response.body));
            } catch (err) {
                handleWorkerError('githubWebhookServer', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, message: 'Webhook ingestion failed' }));
            }
        });
    });

    server.listen(port, () => {
        info('GitHub webhook server started', { port });
    });

    server.on('error', err => {
        warn('GitHub webhook server error', { error: err.message });
    });

    return server;
}

module.exports = {
    startGithubWebhookServer
};

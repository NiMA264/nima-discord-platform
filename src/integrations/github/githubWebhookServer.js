const http = require('http');
const { ingestGithubWebhook } = require('./githubWebhookIngest');
const { info, warn, error } = require('../../utils/logger');

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

        req.on('end', () => {
            try {
                const rawBody = Buffer.concat(chunks).toString('utf8');
                const body = rawBody ? JSON.parse(rawBody) : {};
                const result = ingestGithubWebhook({
                    headers: req.headers,
                    rawBody,
                    body
                });

                res.statusCode = result.statusCode;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ ok: result.ok, message: result.message }));
            } catch (err) {
                error('GitHub webhook ingestion failed', { error: err.message });
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

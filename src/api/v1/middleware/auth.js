const metrics = require('../../../lib/metrics');
const crypto = require('crypto');

function parseBearerToken(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') return '';
    const [scheme, token] = headerValue.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer') return '';
    return String(token || '').trim();
}

function authenticateApiRequest(req, env = process.env) {
    const configuredToken = String(env.PUBLIC_API_TOKEN || '').trim();
    const requestToken = parseBearerToken(req.headers.authorization);
    const isMissingToken = !requestToken;
    const isInvalidToken = Boolean(requestToken) && requestToken !== configuredToken;
    const shouldReject = !configuredToken || isMissingToken || isInvalidToken;

    if (shouldReject) {
        if (!configuredToken) {
            metrics.increment('api_auth_missing_token_total', 1, { reason: 'server_token_not_configured' });
            metrics.increment('api_auth_failed_total', 1, { reason: 'server_token_not_configured' });
        } else if (isMissingToken) {
            metrics.increment('api_auth_missing_token_total', 1, { reason: 'request_missing_bearer' });
            metrics.increment('api_auth_failed_total', 1, { reason: 'request_missing_bearer' });
        } else {
            metrics.increment('api_auth_failed_total', 1, { reason: 'invalid_bearer' });
        }
        return {
            ok: false,
            statusCode: 401,
            body: {
                ok: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Missing or invalid bearer token'
                }
            }
        };
    }

    return {
        ok: true,
        context: {
            authMode: 'token',
            principal: 'api-client',
            tokenFingerprint: crypto.createHash('sha256').update(requestToken).digest('hex').slice(0, 16)
        }
    };
}

module.exports = {
    authenticateApiRequest
};


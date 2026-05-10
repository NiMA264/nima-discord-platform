function parseBearerToken(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') return '';
    const [scheme, token] = headerValue.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer') return '';
    return String(token || '').trim();
}

function authenticateApiRequest(req, env = process.env) {
    const configuredToken = String(env.PUBLIC_API_TOKEN || '').trim();
    const requestToken = parseBearerToken(req.headers.authorization);

    if (!configuredToken) {
        return {
            ok: true,
            context: { authMode: 'disabled', principal: 'anonymous' }
        };
    }

    if (!requestToken || requestToken !== configuredToken) {
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
        context: { authMode: 'token', principal: 'api-client' }
    };
}

module.exports = {
    authenticateApiRequest
};


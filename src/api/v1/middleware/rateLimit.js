const metrics = require('../../../lib/metrics');

function getClientIp(req) {
    const forwarded = String(req?.headers?.['x-forwarded-for'] || '').trim();
    if (forwarded) {
        return forwarded.split(',')[0].trim() || 'unknown';
    }
    return String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown');
}

function createRateLimiter(options = {}) {
    const windowMs = Number(options.windowMs || 60000);
    const globalLimit = Number(options.globalLimit || 300);
    const ipLimit = Number(options.ipLimit || 120);
    const tokenLimit = Number(options.tokenLimit || 60);
    const nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();

    const buckets = new Map();

    function pruneBucket(state, now) {
        const threshold = now - windowMs;
        state.hits = state.hits.filter(ts => ts > threshold);
    }

    function tryConsume(scope, key, limit) {
        const bucketKey = `${scope}:${key}`;
        const now = nowFn();
        const state = buckets.get(bucketKey) || { hits: [] };
        pruneBucket(state, now);

        if (state.hits.length >= limit) {
            const oldest = state.hits[0] || now;
            const retryAfterMs = Math.max(0, windowMs - (now - oldest));
            const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
            metrics.increment('api_rate_limited_total', 1, { scope });
            metrics.increment('api_rate_limit_by_scope_total', 1, { scope });
            return { ok: false, scope, retryAfterSeconds };
        }

        state.hits.push(now);
        buckets.set(bucketKey, state);
        return { ok: true };
    }

    function checkPreAuth(req) {
        const globalResult = tryConsume('global', 'all', globalLimit);
        if (!globalResult.ok) return globalResult;

        const ip = getClientIp(req);
        const ipResult = tryConsume('ip', ip, ipLimit);
        if (!ipResult.ok) return ipResult;

        return { ok: true };
    }

    function checkTokenScope(tokenFingerprint) {
        if (!tokenFingerprint) return { ok: true };
        return tryConsume('token', tokenFingerprint, tokenLimit);
    }

    return {
        checkPreAuth,
        checkTokenScope
    };
}

module.exports = {
    createRateLimiter,
    getClientIp
};

import { describe, expect, it } from 'vitest';

const limiterModule = await import('../src/api/v1/middleware/rateLimit.js');
const authModule = await import('../src/api/v1/middleware/auth.js');

const { createRateLimiter } = limiterModule.default || limiterModule;
const { authenticateApiRequest } = authModule.default || authModule;

function reqWithIp(ip, authHeader = '') {
    return {
        headers: {
            'x-forwarded-for': ip,
            authorization: authHeader
        },
        socket: { remoteAddress: ip }
    };
}

describe('api rate limiter', () => {
    it('limits by ip when threshold is exceeded', () => {
        const limiter = createRateLimiter({
            windowMs: 60000,
            globalLimit: 100,
            ipLimit: 2,
            tokenLimit: 100
        });
        const req = reqWithIp('1.2.3.4');

        expect(limiter.checkPreAuth(req).ok).toBe(true);
        expect(limiter.checkPreAuth(req).ok).toBe(true);
        const third = limiter.checkPreAuth(req);
        expect(third.ok).toBe(false);
        expect(third.scope).toBe('ip');
    });

    it('limits by token and keeps different tokens separated', () => {
        const limiter = createRateLimiter({
            windowMs: 60000,
            globalLimit: 100,
            ipLimit: 100,
            tokenLimit: 2
        });

        const authA = authenticateApiRequest(reqWithIp('9.9.9.1', 'Bearer token-a'), { PUBLIC_API_TOKEN: 'token-a' });
        const authB = authenticateApiRequest(reqWithIp('9.9.9.2', 'Bearer token-b'), { PUBLIC_API_TOKEN: 'token-b' });
        expect(authA.ok).toBe(true);
        expect(authB.ok).toBe(true);

        expect(limiter.checkTokenScope(authA.context.tokenFingerprint).ok).toBe(true);
        expect(limiter.checkTokenScope(authA.context.tokenFingerprint).ok).toBe(true);
        const thirdA = limiter.checkTokenScope(authA.context.tokenFingerprint);
        expect(thirdA.ok).toBe(false);
        expect(thirdA.scope).toBe('token');

        // token-b should still have its own bucket
        expect(limiter.checkTokenScope(authB.context.tokenFingerprint).ok).toBe(true);
    });

    it('auth failures do not count as token traffic', () => {
        const limiter = createRateLimiter({
            windowMs: 60000,
            globalLimit: 100,
            ipLimit: 100,
            tokenLimit: 1
        });

        const unauthorized = authenticateApiRequest(reqWithIp('2.2.2.2', ''), { PUBLIC_API_TOKEN: 'real-token' });
        expect(unauthorized.ok).toBe(false);

        const authorized = authenticateApiRequest(reqWithIp('2.2.2.2', 'Bearer real-token'), { PUBLIC_API_TOKEN: 'real-token' });
        expect(authorized.ok).toBe(true);

        // first successful token hit should pass; unauthorized request didn't consume token bucket
        expect(limiter.checkTokenScope(authorized.context.tokenFingerprint).ok).toBe(true);
        const second = limiter.checkTokenScope(authorized.context.tokenFingerprint);
        expect(second.ok).toBe(false);
        expect(second.scope).toBe('token');
    });
});

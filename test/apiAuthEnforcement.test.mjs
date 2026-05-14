import { describe, expect, it } from 'vitest';

const authModule = await import('../src/api/v1/middleware/auth.js');
const envModule = await import('../src/config/env.js');

const { authenticateApiRequest } = authModule.default || authModule;
const { assertEnvironment } = envModule.default || envModule;

describe('api auth enforcement security smoke', () => {
    it('prod-like environment fails startup when PUBLIC_API_TOKEN is missing and API is enabled', () => {
        expect(() => assertEnvironment({
            DISCORD_TOKEN: 'token',
            DISCORD_CLIENT_ID: 'client',
            DISCORD_GUILD_ID: 'guild',
            DATABASE_URL: 'file:./dev.db',
            NODE_ENV: 'production',
            PUBLIC_API_ENABLED: 'true',
            PUBLIC_API_TOKEN: ''
        })).toThrow(/PUBLIC_API_TOKEN/);
    });

    it('request without bearer token returns 401', () => {
        const result = authenticateApiRequest(
            { headers: {} },
            { PUBLIC_API_TOKEN: 'secret-token' }
        );
        expect(result.ok).toBe(false);
        expect(result.statusCode).toBe(401);
    });

    it('request with wrong bearer token returns 401', () => {
        const result = authenticateApiRequest(
            { headers: { authorization: 'Bearer wrong' } },
            { PUBLIC_API_TOKEN: 'secret-token' }
        );
        expect(result.ok).toBe(false);
        expect(result.statusCode).toBe(401);
    });

    it('request with correct bearer token is authorized', () => {
        const result = authenticateApiRequest(
            { headers: { authorization: 'Bearer secret-token' } },
            { PUBLIC_API_TOKEN: 'secret-token' }
        );
        expect(result.ok).toBe(true);
        expect(result.context.authMode).toBe('token');
    });
});

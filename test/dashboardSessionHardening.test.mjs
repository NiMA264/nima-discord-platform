import { describe, expect, it } from 'vitest';

const envModule = await import('../dashboard/src/config/env.js');
const sessionModule = await import('../dashboard/src/lib/session.js');

const { loadDashboardEnv } = envModule.default || envModule;
const { buildSessionOptions } = sessionModule.default || sessionModule;

describe('dashboard session hardening', () => {
    it('uses secure cookies in production with explicit proxy trust', () => {
        const env = loadDashboardEnv({
            NODE_ENV: 'production',
            DASHBOARD_SESSION_SECRET: 'secret',
            DISCORD_CLIENT_ID: 'id',
            DISCORD_CLIENT_SECRET: 'secret2',
            DISCORD_REDIRECT_URI: 'https://dashboard.example.com/auth/discord/callback',
            DASHBOARD_TRUST_PROXY: 'true'
        });

        const options = buildSessionOptions({
            secret: env.sessionSecret,
            secure: env.sessionCookieSecure,
            sameSite: env.sessionCookieSameSite
        });
        expect(options.cookie.secure).toBe(true);
        expect(options.cookie.httpOnly).toBe(true);
        expect(options.cookie.sameSite).toBe('lax');
    });

    it('keeps local development cookies usable', () => {
        const env = loadDashboardEnv({
            NODE_ENV: 'development',
            DASHBOARD_SESSION_SECRET: 'secret',
            DISCORD_CLIENT_ID: 'id',
            DISCORD_CLIENT_SECRET: 'secret2',
            DISCORD_REDIRECT_URI: 'http://localhost:3100/auth/discord/callback'
        });

        const options = buildSessionOptions({
            secret: env.sessionSecret,
            secure: env.sessionCookieSecure,
            sameSite: env.sessionCookieSameSite
        });
        expect(options.cookie.secure).toBe(false);
        expect(options.cookie.sameSite).toBe('lax');
    });

    it('supports strict/lax sameSite policy from env for oauth callback compatibility control', () => {
        const strictEnv = loadDashboardEnv({
            NODE_ENV: 'development',
            DASHBOARD_SESSION_SECRET: 'secret',
            DISCORD_CLIENT_ID: 'id',
            DISCORD_CLIENT_SECRET: 'secret2',
            DISCORD_REDIRECT_URI: 'http://localhost:3100/auth/discord/callback',
            DASHBOARD_SESSION_COOKIE_SAMESITE: 'strict'
        });
        expect(strictEnv.sessionCookieSameSite).toBe('strict');

        const laxEnv = loadDashboardEnv({
            NODE_ENV: 'development',
            DASHBOARD_SESSION_SECRET: 'secret',
            DISCORD_CLIENT_ID: 'id',
            DISCORD_CLIENT_SECRET: 'secret2',
            DISCORD_REDIRECT_URI: 'http://localhost:3100/auth/discord/callback',
            DASHBOARD_SESSION_COOKIE_SAMESITE: 'lax'
        });
        expect(laxEnv.sessionCookieSameSite).toBe('lax');
    });

    it('fails fast on missing session secret in production', () => {
        expect(() => loadDashboardEnv({
            NODE_ENV: 'production',
            DASHBOARD_TRUST_PROXY: 'true',
            DISCORD_CLIENT_ID: 'id',
            DISCORD_CLIENT_SECRET: 'secret2',
            DISCORD_REDIRECT_URI: 'https://dashboard.example.com/auth/discord/callback'
        })).toThrow(/DASHBOARD_SESSION_SECRET/);
    });

    it('fails fast on insecure proxy/cookie setup in production', () => {
        expect(() => loadDashboardEnv({
            NODE_ENV: 'production',
            DASHBOARD_SESSION_SECRET: 'secret',
            DISCORD_CLIENT_ID: 'id',
            DISCORD_CLIENT_SECRET: 'secret2',
            DISCORD_REDIRECT_URI: 'https://dashboard.example.com/auth/discord/callback',
            DASHBOARD_TRUST_PROXY: 'false',
            DASHBOARD_SESSION_COOKIE_SECURE: 'true'
        })).toThrow(/DASHBOARD_TRUST_PROXY/);
    });
});

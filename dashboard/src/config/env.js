const required = [
    'DASHBOARD_SESSION_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI'
];

function parseBoolean(value, fallback = false) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
}

function loadDashboardEnv(env = process.env) {
    const missing = required.filter(key => !env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing dashboard env: ${missing.join(', ')}`);
    }

    const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
    const isProduction = nodeEnv === 'production';
    const trustProxy = parseBoolean(env.DASHBOARD_TRUST_PROXY, false);
    const secureCookies = parseBoolean(env.DASHBOARD_SESSION_COOKIE_SECURE, isProduction);
    const sameSite = String(env.DASHBOARD_SESSION_COOKIE_SAMESITE || 'lax').trim().toLowerCase();
    if (!['lax', 'strict', 'none'].includes(sameSite)) {
        throw new Error('Invalid DASHBOARD_SESSION_COOKIE_SAMESITE, allowed: lax|strict|none');
    }

    if (isProduction && secureCookies && !trustProxy) {
        throw new Error('Production dashboard with secure cookies requires DASHBOARD_TRUST_PROXY=true');
    }

    const redirectUri = String(env.DISCORD_REDIRECT_URI || '').trim();
    if (isProduction && !redirectUri.startsWith('https://')) {
        throw new Error('Production dashboard requires HTTPS DISCORD_REDIRECT_URI');
    }

    return {
        port: Number(env.DASHBOARD_PORT || 3100),
        sessionSecret: env.DASHBOARD_SESSION_SECRET,
        discordClientId: env.DISCORD_CLIENT_ID,
        discordClientSecret: env.DISCORD_CLIENT_SECRET,
        discordRedirectUri: redirectUri,
        nodeEnv,
        trustProxy,
        sessionCookieSecure: secureCookies,
        sessionCookieSameSite: sameSite
    };
}

module.exports = {
    loadDashboardEnv
};

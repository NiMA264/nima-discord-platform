const required = [
    'DASHBOARD_SESSION_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI'
];

function loadDashboardEnv(env = process.env) {
    const missing = required.filter(key => !env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing dashboard env: ${missing.join(', ')}`);
    }

    return {
        port: Number(env.DASHBOARD_PORT || 3100),
        sessionSecret: env.DASHBOARD_SESSION_SECRET,
        discordClientId: env.DISCORD_CLIENT_ID,
        discordClientSecret: env.DISCORD_CLIENT_SECRET,
        discordRedirectUri: env.DISCORD_REDIRECT_URI
    };
}

module.exports = {
    loadDashboardEnv
};

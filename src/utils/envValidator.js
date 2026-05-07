const requiredKeys = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID'
];

function validateEnv(env = process.env) {
    const missing = requiredKeys.filter(key => !env[key] || String(env[key]).trim() === '');

    if (missing.length) {
        for (const key of missing) {
            console.error(`[ENV ERROR] Missing ${key} in .env`);
        }

        return { ok: false, missing };
    }

    return { ok: true, missing: [] };
}

module.exports = { validateEnv, requiredKeys };

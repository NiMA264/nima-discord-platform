const { validateEnvironment } = require('../config/env');

const requiredKeys = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID'
];

function validateEnv(env = process.env) {
    const missing = requiredKeys.filter(key => !env[key] || String(env[key]).trim() === '');
    if (missing.length) {
        return { ok: false, missing };
    }

    // keep legacy contract while still exercising central validator side-effects/warnings.
    validateEnvironment(env);
    return { ok: true, missing: [] };
}

module.exports = { validateEnv, requiredKeys };

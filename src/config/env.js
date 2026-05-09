const { scoped } = require('../utils/logger');

const envLog = scoped('ENV');

const requiredKeys = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'DATABASE_URL'
];

function collectMissing(env, keys) {
    return keys.filter(key => !env[key] || String(env[key]).trim() === '');
}

function validateEnvironment(env = process.env) {
    const required = [...requiredKeys];
    if (String(env.GITHUB_WEBHOOK_ENABLED || '').toLowerCase() === 'true') {
        required.push('GITHUB_WEBHOOK_SECRET');
    }

    const missing = collectMissing(env, required);
    if (missing.length) {
        for (const key of missing) {
            envLog.error('Missing required env', { key });
        }
        return { ok: false, missing, warnings: [] };
    }

    const warnings = [];
    if (!env.OPENAI_API_KEY || String(env.OPENAI_API_KEY).trim() === '') {
        const warning = 'OPENAI_API_KEY missing - AI commands will use deterministic fallback';
        warnings.push(warning);
        envLog.warn(warning);
    }

    return { ok: true, missing: [], warnings };
}

function assertEnvironment(env = process.env) {
    const result = validateEnvironment(env);
    if (!result.ok) {
        const err = new Error(`Environment validation failed: ${result.missing.join(', ')}`);
        err.code = 'ENV_VALIDATION_FAILED';
        throw err;
    }
    return result;
}

module.exports = {
    requiredKeys,
    validateEnvironment,
    assertEnvironment
};

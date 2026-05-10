const { defaultWorkspaceConfig } = require('./workspaceService');

function resolveWorkspaceId({ userId, explicitWorkspaceId, guildId } = {}, env = process.env) {
    const explicit = String(explicitWorkspaceId || '').trim();
    if (explicit) return explicit;

    const { defaultWorkspaceId } = defaultWorkspaceConfig(env);
    return defaultWorkspaceId;
}

module.exports = {
    resolveWorkspaceId
};


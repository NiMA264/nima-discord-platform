const DEFAULT_SUPPORT_INVITE_URL = 'https://discord.gg/AXdpsawDYE';

function getSupportInviteUrl(env = process.env) {
    return String(env.SUPPORT_INVITE_URL || DEFAULT_SUPPORT_INVITE_URL).trim() || DEFAULT_SUPPORT_INVITE_URL;
}

function buildSupportGateMessage(env = process.env) {
    const inviteUrl = getSupportInviteUrl(env);
    return [
        '🚫 Du musst zuerst dem offiziellen NiMa Support-Server beitreten, um den Bot nutzen zu können.',
        '',
        `➡️ ${inviteUrl}`
    ].join('\n');
}

function buildSupportRequirementText(env = process.env) {
    const inviteUrl = getSupportInviteUrl(env);
    return `Support-Server Pflicht: ${inviteUrl}`;
}

module.exports = {
    DEFAULT_SUPPORT_INVITE_URL,
    getSupportInviteUrl,
    buildSupportGateMessage,
    buildSupportRequirementText
};


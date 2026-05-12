const workspaceSettingsRepository = require('../repositories/workspaceSettingsRepository');
const { scoped } = require('../utils/logger');

const digestDeliveryLog = scoped('DIGEST_DELIVERY');
let discordClient = null;

function setDiscordDigestDeliveryClient(client) {
    discordClient = client;
}

function buildDigestMessage(digest) {
    const topTypes = (digest.byType || [])
        .slice(0, 3)
        .map(item => `${item.key}: ${item.count}`)
        .join('\n');

    const lines = [
        `Workflow Digest (${digest.workspaceId})`,
        `Total suggestions: ${digest.totalSuggestions}`,
        topTypes ? `Top signals:\n${topTypes}` : 'Top signals: none'
    ];
    if (digest.aiSummary) {
        lines.push(`AI summary: ${digest.aiSummary}`);
    }
    return lines.join('\n');
}

async function deliverWorkspaceDigest({ guildId, workspaceId, digest }) {
    if (!discordClient) return { delivered: false, reason: 'no_client' };
    const settings = workspaceSettingsRepository.getWorkspaceSettings(workspaceId);
    const channelId = String(settings?.digest_channel_id || '').trim();
    if (!channelId) return { delivered: false, reason: 'no_channel_config' };

    const channel = await discordClient.channels.fetch(channelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') {
        return { delivered: false, reason: 'channel_unavailable' };
    }

    const content = buildDigestMessage(digest);
    await channel.send({ content });
    digestDeliveryLog.info('Workflow digest delivered', {
        guildId,
        workspaceId,
        channelId,
        totalSuggestions: digest.totalSuggestions
    });
    return { delivered: true, channelId };
}

module.exports = {
    setDiscordDigestDeliveryClient,
    deliverWorkspaceDigest,
    buildDigestMessage
};

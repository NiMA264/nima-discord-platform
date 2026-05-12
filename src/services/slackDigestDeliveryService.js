const workspaceSettingsRepository = require('../repositories/workspaceSettingsRepository');
const { buildDigestMessage } = require('./discordDigestDeliveryService');
const { scoped } = require('../utils/logger');

const slackDigestLog = scoped('SLACK_DIGEST_DELIVERY');

async function deliverWorkspaceDigestToSlack({ guildId, workspaceId, digest }) {
    const settings = workspaceSettingsRepository.getWorkspaceSettings(workspaceId);
    const webhookUrl = String(settings?.slack_webhook_url || '').trim();
    if (!webhookUrl) return { delivered: false, reason: 'no_webhook_config' };

    const text = buildDigestMessage(digest);
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
    }).catch(() => null);

    if (!response || !response.ok) {
        return { delivered: false, reason: 'webhook_failed' };
    }

    slackDigestLog.info('Workflow digest delivered to Slack', {
        guildId,
        workspaceId,
        totalSuggestions: digest.totalSuggestions
    });
    return { delivered: true };
}

module.exports = {
    deliverWorkspaceDigestToSlack
};

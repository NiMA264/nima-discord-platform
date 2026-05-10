const { getGuildSettings } = require('../repositories/guildSettingsRepository');

function getGuildChannelConfig(guildId) {
    const row = getGuildSettings(guildId) || {};
    return {
        setupCategoryId: row.setup_category_id || null,
        welcomeChannelId: row.welcome_channel_id || null,
        botChannelId: row.bot_channel_id || null,
        projectForumChannelId: row.project_forum_channel_id || null,
        knowledgeChannelId: row.knowledge_channel_id || null
    };
}

module.exports = {
    getGuildChannelConfig
};

const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    getByGuild: db.prepare(`
        SELECT *
        FROM guild_settings
        WHERE guild_id = ?
        LIMIT 1
    `),
    upsertChannels: db.prepare(`
        INSERT INTO guild_settings (
            guild_id,
            welcome_channel_id,
            bot_channel_id,
            project_forum_channel_id,
            knowledge_channel_id,
            setup_category_id
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            welcome_channel_id = excluded.welcome_channel_id,
            bot_channel_id = excluded.bot_channel_id,
            project_forum_channel_id = excluded.project_forum_channel_id,
            knowledge_channel_id = excluded.knowledge_channel_id,
            setup_category_id = excluded.setup_category_id
    `)
};

function getGuildSettings(guildId) {
    return statements.getByGuild.get(guildId) || null;
}

function upsertGuildChannelSettings({
    guildId,
    welcomeChannelId,
    botChannelId,
    projectForumChannelId,
    knowledgeChannelId,
    setupCategoryId
}) {
    return statements.upsertChannels.run(
        guildId,
        welcomeChannelId || null,
        botChannelId || null,
        projectForumChannelId || null,
        knowledgeChannelId || null,
        setupCategoryId || null
    );
}

module.exports = {
    getGuildSettings,
    upsertGuildChannelSettings
};

const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    createAnnouncement: db.prepare(`
        INSERT INTO announcements (guild_id, channel_id, message_id, author_id, title, category, importance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
};

function createAnnouncement(data) {
    return statements.createAnnouncement.run(
        data.guildId,
        data.channelId,
        data.messageId,
        data.authorId,
        data.title,
        data.category,
        data.importance,
        data.createdAt
    );
}

module.exports = { createAnnouncement };

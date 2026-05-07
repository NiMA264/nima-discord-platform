const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    createMemory: db.prepare(`
        INSERT INTO ai_memory (guild_id, channel_id, user_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    getRecentMemory: db.prepare(`
        SELECT role, content, created_at
        FROM ai_memory
        WHERE guild_id = ? AND channel_id = ?
        ORDER BY id DESC
        LIMIT ?
    `),
    cleanupBeforeDate: db.prepare(`
        DELETE FROM ai_memory
        WHERE created_at < ?
    `)
};

function createMemoryEntry(data) {
    return statements.createMemory.run(data.guildId, data.channelId, data.userId, data.role, data.content, data.createdAt);
}

function getRecentMemory(guildId, channelId, limit) {
    const rows = statements.getRecentMemory.all(guildId, channelId, limit);
    return rows.reverse();
}

function cleanupMemoryBefore(isoDate) {
    return statements.cleanupBeforeDate.run(isoDate);
}

module.exports = {
    createMemoryEntry,
    getRecentMemory,
    cleanupMemoryBefore
};

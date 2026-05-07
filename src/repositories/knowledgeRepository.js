const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    createEntry: db.prepare(`
        INSERT INTO knowledge_entries (
            guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    createEvent: db.prepare(`
        INSERT INTO knowledge_events (
            guild_id, channel_id, thread_id, message_id, event_type, details, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    searchEntries: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at
        FROM knowledge_entries
        WHERE guild_id = ?
          AND (
            LOWER(title) LIKE LOWER(?)
            OR LOWER(content) LIKE LOWER(?)
            OR LOWER(tags) LIKE LOWER(?)
          )
        ORDER BY id DESC
        LIMIT ?
    `),
    getThreadEntries: db.prepare(`
        SELECT id, title, content, created_at, source_message_id
        FROM knowledge_entries
        WHERE guild_id = ? AND thread_id = ? AND source_type = 'message'
        ORDER BY id DESC
        LIMIT ?
    `)
};

function createKnowledgeEntry(data) {
    return statements.createEntry.run(
        data.guildId,
        data.channelId,
        data.threadId || null,
        data.sourceMessageId || null,
        data.sourceType,
        data.title,
        data.content,
        data.tags || '',
        data.createdBy,
        data.createdAt
    );
}

function createKnowledgeEvent(data) {
    return statements.createEvent.run(
        data.guildId,
        data.channelId,
        data.threadId || null,
        data.messageId || null,
        data.eventType,
        data.details || '',
        data.createdAt
    );
}

function searchKnowledgeEntries(guildId, query, limit = 5) {
    const needle = `%${String(query || '').trim()}%`;
    return statements.searchEntries.all(guildId, needle, needle, needle, limit);
}

function getThreadKnowledgeEntries(guildId, threadId, limit = 40) {
    return statements.getThreadEntries.all(guildId, threadId, limit).reverse();
}

module.exports = {
    createKnowledgeEntry,
    createKnowledgeEvent,
    searchKnowledgeEntries,
    getThreadKnowledgeEntries
};

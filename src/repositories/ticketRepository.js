const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    create: db.prepare(`
        INSERT INTO tickets (guild_id, channel_id, owner_id, subject, created_at)
        VALUES (?, ?, ?, ?, ?)
    `),
    findOpenByOwner: db.prepare(`
        SELECT * FROM tickets
        WHERE guild_id = ? AND owner_id = ? AND closed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
    `),
    closeByChannelId: db.prepare(`
        UPDATE tickets
        SET closed_at = ?, closed_by = ?
        WHERE guild_id = ? AND channel_id = ? AND closed_at IS NULL
    `),
    findByChannelId: db.prepare(`
        SELECT * FROM tickets
        WHERE guild_id = ? AND channel_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `),
    insertTranscriptMeta: db.prepare(`
        INSERT INTO ticket_transcripts (ticket_id, channel_id, metadata, created_at)
        VALUES (?, ?, ?, ?)
    `)
};

function createTicket(data) {
    return statements.create.run(data.guildId, data.channelId, data.ownerId, data.subject, data.createdAt);
}

function findOpenTicketByOwner(guildId, ownerId) {
    return statements.findOpenByOwner.get(guildId, ownerId) || null;
}

function closeTicketByChannelId(data) {
    return statements.closeByChannelId.run(data.closedAt, data.closedBy, data.guildId, data.channelId);
}

function findTicketByChannelId(guildId, channelId) {
    return statements.findByChannelId.get(guildId, channelId) || null;
}

function insertTicketTranscriptMeta(data) {
    return statements.insertTranscriptMeta.run(data.ticketId, data.channelId, data.metadata, data.createdAt);
}

module.exports = {
    createTicket,
    findOpenTicketByOwner,
    closeTicketByChannelId,
    findTicketByChannelId,
    insertTicketTranscriptMeta
};

const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    createWarning: db.prepare(`
        INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
    `)
};

function createWarning(data) {
    return statements.createWarning.run(data.guildId, data.userId, data.moderatorId, data.reason, data.createdAt);
}

module.exports = { createWarning };

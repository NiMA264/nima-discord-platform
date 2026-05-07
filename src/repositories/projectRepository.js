const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    createProject: db.prepare(`
        INSERT INTO projects (guild_id, thread_id, creator_id, name, description, stack, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
};

function createProject(data) {
    return statements.createProject.run(
        data.guildId,
        data.threadId,
        data.creatorId,
        data.name,
        data.description,
        data.stack,
        data.status,
        data.createdAt
    );
}

module.exports = { createProject };

const { getDatabase, SCHEMA_VERSION } = require('../database/database');

const db = getDatabase();

const statements = {
    getByGuild: db.prepare('SELECT * FROM server_build_state WHERE guild_id = ? LIMIT 1'),
    upsert: db.prepare(`
        INSERT INTO server_build_state (guild_id, built_at, schema_version)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id)
        DO UPDATE SET built_at = excluded.built_at, schema_version = excluded.schema_version
    `)
};

function getServerBuildState(guildId) {
    return statements.getByGuild.get(guildId) || null;
}

function upsertServerBuildState(guildId, builtAt = new Date().toISOString(), schemaVersion = SCHEMA_VERSION) {
    return statements.upsert.run(guildId, builtAt, schemaVersion);
}

module.exports = {
    getServerBuildState,
    upsertServerBuildState
};

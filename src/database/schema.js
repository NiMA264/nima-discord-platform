const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS db_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        created_at TEXT NOT NULL,
        closed_at TEXT,
        closed_by TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_owner_open ON tickets (guild_id, owner_id, closed_at);`,
    `CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings (guild_id, user_id, created_at);`,
    `CREATE TABLE IF NOT EXISTS ai_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_memory_context ON ai_memory (guild_id, channel_id, created_at);`,
    `CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        stack TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_projects_thread ON projects (guild_id, thread_id);`,
    `CREATE TABLE IF NOT EXISTS ticket_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(ticket_id) REFERENCES tickets(id)
    );`,
    `CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        importance TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS server_build_state (
        guild_id TEXT PRIMARY KEY,
        built_at TEXT NOT NULL,
        schema_version TEXT NOT NULL
    );`
];

module.exports = { schemaStatements };

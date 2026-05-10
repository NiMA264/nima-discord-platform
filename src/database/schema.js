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
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_uid ON projects (project_uid);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);`,
    `CREATE INDEX IF NOT EXISTS idx_projects_thread ON projects (guild_id, thread_id);`,
    `CREATE TABLE IF NOT EXISTS project_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_uid TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_uid, user_id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members (project_uid, role);`,
    `CREATE TABLE IF NOT EXISTS project_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_uid TEXT NOT NULL,
        source TEXT NOT NULL,
        event_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_project_logs_project ON project_logs (project_uid, created_at);`,
    `CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        dashboard_enabled INTEGER NOT NULL DEFAULT 1,
        github_enabled INTEGER NOT NULL DEFAULT 0,
        welcome_channel_id TEXT,
        bot_channel_id TEXT,
        help_channel_id TEXT,
        project_forum_channel_id TEXT,
        knowledge_channel_id TEXT,
        setup_category_id TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS role_bindings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        discord_role_id TEXT NOT NULL,
        project_role TEXT NOT NULL,
        UNIQUE(guild_id, discord_role_id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_role_bindings_lookup ON role_bindings (guild_id, project_role);`,
    `CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS workspace_memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(workspace_id, user_id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace ON workspace_memberships (workspace_id, role);`,
    `CREATE TABLE IF NOT EXISTS github_webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        project_uid TEXT,
        event_name TEXT NOT NULL,
        delivery_id TEXT,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        created_at TEXT NOT NULL,
        processed_at TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_github_webhook_events_status ON github_webhook_events (status, created_at);`,
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
    );`,
    `CREATE TABLE IF NOT EXISTS knowledge_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_id TEXT,
        source_message_id TEXT,
        source_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        is_accepted_solution INTEGER NOT NULL DEFAULT 0,
        accepted_by TEXT,
        accepted_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_entries_scope ON knowledge_entries (guild_id, channel_id, thread_id, created_at);`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_entries_fts USING fts5(title, content, tags, content='knowledge_entries', content_rowid='id');`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_entries_ai AFTER INSERT ON knowledge_entries BEGIN
        INSERT INTO knowledge_entries_fts(rowid, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_entries_ad AFTER DELETE ON knowledge_entries BEGIN
        INSERT INTO knowledge_entries_fts(knowledge_entries_fts, rowid, title, content, tags) VALUES('delete', old.id, old.title, old.content, old.tags);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS knowledge_entries_au AFTER UPDATE ON knowledge_entries BEGIN
        INSERT INTO knowledge_entries_fts(knowledge_entries_fts, rowid, title, content, tags) VALUES('delete', old.id, old.title, old.content, old.tags);
        INSERT INTO knowledge_entries_fts(rowid, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
    END;`,
    `CREATE TABLE IF NOT EXISTS knowledge_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_id TEXT,
        message_id TEXT,
        user_id TEXT,
        ask_context_id TEXT,
        event_type TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_knowledge_events_scope ON knowledge_events (guild_id, channel_id, thread_id, created_at);`
    ,`CREATE INDEX IF NOT EXISTS idx_knowledge_events_feedback ON knowledge_events (guild_id, ask_context_id, user_id, event_type, created_at);`,
    `CREATE TABLE IF NOT EXISTS knowledge_feedback_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        ask_context_id TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        status TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_at TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(guild_id, ask_context_id, feedback_type)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_feedback_reviews_scope ON knowledge_feedback_reviews (guild_id, feedback_type, status, updated_at);`
];

module.exports = { schemaStatements };

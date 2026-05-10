const { getDatabase } = require('./database');
const statements = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_uid ON projects (project_uid);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);`,
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
    `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_uid TEXT NOT NULL UNIQUE,
        project_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'TODO',
        assigned_to TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        closed_at TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_uid, status, created_at);`,
    `CREATE TABLE IF NOT EXISTS sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sprint_uid TEXT NOT NULL UNIQUE,
        project_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        started_by TEXT NOT NULL,
        started_at TEXT NOT NULL,
        closed_by TEXT,
        closed_at TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints (project_uid, status, started_at);`,
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
    `CREATE INDEX IF NOT EXISTS idx_github_webhook_events_status ON github_webhook_events (status, created_at);`
];

function hasColumn(db, table, column) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some(item => item.name === column);
}

function ensureColumn(db, table, column, definition) {
    if (hasColumn(db, table, column)) return;
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition};`).run();
}

function ensurePhase1Persistence() {
    const db = getDatabase();

    ensureColumn(db, 'projects', 'project_uid', 'project_uid TEXT');
    ensureColumn(db, 'projects', 'slug', 'slug TEXT');
    ensureColumn(db, 'projects', 'repo_url', 'repo_url TEXT');
    ensureColumn(db, 'projects', 'github_repo_id', 'github_repo_id TEXT');
    ensureColumn(db, 'projects', 'forum_channel_id', 'forum_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'welcome_channel_id', 'welcome_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'bot_channel_id', 'bot_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'project_forum_channel_id', 'project_forum_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'knowledge_channel_id', 'knowledge_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'setup_category_id', 'setup_category_id TEXT');

    for (const statement of statements) {
        db.prepare(statement).run();
    }
}

module.exports = {
    ensurePhase1Persistence
};

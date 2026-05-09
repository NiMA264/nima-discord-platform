const { getDatabase } = require('./database');
const { dbWarn } = require('../utils/logger');

const statements = [
    `ALTER TABLE projects ADD COLUMN project_uid TEXT;`,
    `ALTER TABLE projects ADD COLUMN slug TEXT;`,
    `ALTER TABLE projects ADD COLUMN repo_url TEXT;`,
    `ALTER TABLE projects ADD COLUMN github_repo_id TEXT;`,
    `ALTER TABLE projects ADD COLUMN forum_channel_id TEXT;`,
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
        github_enabled INTEGER NOT NULL DEFAULT 0
    );`,
    `CREATE TABLE IF NOT EXISTS role_bindings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        discord_role_id TEXT NOT NULL,
        project_role TEXT NOT NULL,
        UNIQUE(guild_id, discord_role_id)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_role_bindings_lookup ON role_bindings (guild_id, project_role);`,
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

function ensurePhase1Persistence() {
    const db = getDatabase();

    for (const statement of statements) {
        try {
            db.prepare(statement).run();
        } catch (err) {
            const isDuplicateColumn = statement.startsWith('ALTER TABLE projects ADD COLUMN')
                && err.message.includes('duplicate column name');
            if (isDuplicateColumn) {
                dbWarn('Optional phase1 migration statement skipped', { error: err.message });
                continue;
            }
            throw err;
        }
    }
}

module.exports = {
    ensurePhase1Persistence
};

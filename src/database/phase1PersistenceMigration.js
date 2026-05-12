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
    `CREATE TABLE IF NOT EXISTS workspace_settings (
        workspace_id TEXT PRIMARY KEY,
        digest_channel_id TEXT,
        slack_webhook_url TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_uid TEXT NOT NULL UNIQUE,
        project_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        assignee_user_id TEXT,
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
    `CREATE INDEX IF NOT EXISTS idx_github_webhook_events_status ON github_webhook_events (status, created_at);`,
    `CREATE TABLE IF NOT EXISTS github_repository_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_full_name TEXT NOT NULL UNIQUE,
        workspace_id TEXT NOT NULL,
        created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_github_repository_mappings_workspace ON github_repository_mappings (workspace_id);`
];

function hasColumn(db, table, column) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some(item => item.name === column);
}

function ensureColumn(db, table, column, definition) {
    if (hasColumn(db, table, column)) return;
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition};`).run();
    } catch (err) {
        if (String(err?.message || '').toLowerCase().includes('duplicate column name')) return;
        throw err;
    }
}

function ensurePhase1Persistence() {
    const db = getDatabase();

    ensureColumn(db, 'projects', 'project_uid', 'project_uid TEXT');
    ensureColumn(db, 'projects', 'slug', 'slug TEXT');
    ensureColumn(db, 'projects', 'repo_url', 'repo_url TEXT');
    ensureColumn(db, 'projects', 'github_repo_id', 'github_repo_id TEXT');
    ensureColumn(db, 'projects', 'forum_channel_id', 'forum_channel_id TEXT');
    ensureColumn(db, 'projects', 'workspace_id', `workspace_id TEXT NOT NULL DEFAULT 'default-workspace'`);
    ensureColumn(db, 'project_logs', 'workspace_id', `workspace_id TEXT NOT NULL DEFAULT 'default-workspace'`);
    ensureColumn(db, 'tasks', 'workspace_id', `workspace_id TEXT NOT NULL DEFAULT 'default-workspace'`);
    ensureColumn(db, 'tasks', 'assignee_user_id', 'assignee_user_id TEXT');
    ensureColumn(db, 'guild_settings', 'welcome_channel_id', 'welcome_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'bot_channel_id', 'bot_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'help_channel_id', 'help_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'project_forum_channel_id', 'project_forum_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'knowledge_channel_id', 'knowledge_channel_id TEXT');
    ensureColumn(db, 'guild_settings', 'setup_category_id', 'setup_category_id TEXT');
    ensureColumn(db, 'workspace_settings', 'slack_webhook_url', 'slack_webhook_url TEXT');

    for (const statement of statements) {
        db.prepare(statement).run();
    }

    db.prepare(`
        UPDATE projects
        SET workspace_id = 'default-workspace'
        WHERE workspace_id IS NULL OR trim(workspace_id) = ''
    `).run();
    db.prepare(`
        UPDATE project_logs
        SET workspace_id = (
            SELECT p.workspace_id FROM projects p WHERE p.project_uid = project_logs.project_uid
        )
        WHERE workspace_id IS NULL OR trim(workspace_id) = ''
    `).run();
    db.prepare(`
        UPDATE project_logs
        SET workspace_id = 'default-workspace'
        WHERE workspace_id IS NULL OR trim(workspace_id) = ''
    `).run();
    db.prepare(`
        UPDATE tasks
        SET workspace_id = (
            SELECT p.workspace_id FROM projects p WHERE p.project_uid = tasks.project_uid
        )
        WHERE workspace_id IS NULL OR trim(workspace_id) = ''
    `).run();
    db.prepare(`
        UPDATE tasks
        SET workspace_id = 'default-workspace'
        WHERE workspace_id IS NULL OR trim(workspace_id) = ''
    `).run();
    db.prepare(`
        UPDATE tasks
        SET assignee_user_id = assigned_to
        WHERE (assignee_user_id IS NULL OR trim(assignee_user_id) = '')
          AND assigned_to IS NOT NULL
          AND trim(assigned_to) <> ''
    `).run();
    db.prepare(`
        UPDATE tasks
        SET status = CASE
            WHEN lower(trim(status)) IN ('todo', 'open') THEN 'open'
            WHEN lower(trim(status)) IN ('in_progress', 'doing') THEN 'in_progress'
            WHEN lower(trim(status)) IN ('done', 'completed', 'closed') THEN 'done'
            ELSE 'open'
        END
        WHERE status IS NULL
           OR trim(status) = ''
           OR lower(trim(status)) IN ('todo', 'open', 'in_progress', 'doing', 'done', 'completed', 'closed')
    `).run();
}

module.exports = {
    ensurePhase1Persistence
};

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { schemaStatements } = require('./schema');
const { dbInfo, dbWarn, dbError } = require('../utils/logger');

let dbInstance;
const SCHEMA_VERSION = '7';

function hasColumn(db, table, column) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some(item => item.name === column);
}

function ensureColumn(db, table, column, definition) {
    if (hasColumn(db, table, column)) return false;
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition};`).run();
    } catch (err) {
        if (String(err?.message || '').toLowerCase().includes('duplicate column name')) {
            return false;
        }
        throw err;
    }
    return true;
}

function assertDatabasePathReachable(dbPath) {
    const dir = path.dirname(dbPath);
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);

    if (fs.existsSync(dbPath)) {
        fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    }
}

function initializeDatabase() {
    if (dbInstance) {
        return dbInstance;
    }

    const dbPath = path.join(process.cwd(), 'nima.sqlite3');

    try {
        assertDatabasePathReachable(dbPath);
    } catch (err) {
        dbError('Database path not reachable', { dbPath, error: err.message });
        throw err;
    }

    dbInstance = new Database(dbPath);

    try {
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('foreign_keys = ON');

        for (const statement of schemaStatements) {
            try {
                dbInstance.prepare(statement).run();
            } catch (err) {
                const optionalFts = statement.includes('fts5') || statement.includes('knowledge_entries_fts');
                if (optionalFts) {
                    dbWarn('Optional schema statement skipped', { error: err.message });
                    continue;
                }
                throw err;
            }
        }

        ensureColumn(dbInstance, 'projects', 'project_uid', 'project_uid TEXT');
        ensureColumn(dbInstance, 'projects', 'slug', 'slug TEXT');
        ensureColumn(dbInstance, 'projects', 'repo_url', 'repo_url TEXT');
        ensureColumn(dbInstance, 'projects', 'github_repo_id', 'github_repo_id TEXT');
        ensureColumn(dbInstance, 'projects', 'forum_channel_id', 'forum_channel_id TEXT');
        ensureColumn(dbInstance, 'projects', 'workspace_id', `workspace_id TEXT NOT NULL DEFAULT 'default-workspace'`);
        ensureColumn(dbInstance, 'project_logs', 'workspace_id', `workspace_id TEXT NOT NULL DEFAULT 'default-workspace'`);
        ensureColumn(dbInstance, 'tasks', 'workspace_id', `workspace_id TEXT NOT NULL DEFAULT 'default-workspace'`);
        ensureColumn(dbInstance, 'tasks', 'assignee_user_id', 'assignee_user_id TEXT');
        ensureColumn(dbInstance, 'knowledge_entries', 'is_accepted_solution', 'is_accepted_solution INTEGER NOT NULL DEFAULT 0');
        ensureColumn(dbInstance, 'knowledge_entries', 'accepted_by', 'accepted_by TEXT');
        ensureColumn(dbInstance, 'knowledge_entries', 'accepted_at', 'accepted_at TEXT');
        ensureColumn(dbInstance, 'knowledge_events', 'user_id', 'user_id TEXT');
        ensureColumn(dbInstance, 'knowledge_events', 'ask_context_id', 'ask_context_id TEXT');
        ensureColumn(dbInstance, 'guild_settings', 'welcome_channel_id', 'welcome_channel_id TEXT');
        ensureColumn(dbInstance, 'guild_settings', 'bot_channel_id', 'bot_channel_id TEXT');
        ensureColumn(dbInstance, 'guild_settings', 'help_channel_id', 'help_channel_id TEXT');
        ensureColumn(dbInstance, 'guild_settings', 'project_forum_channel_id', 'project_forum_channel_id TEXT');
        ensureColumn(dbInstance, 'guild_settings', 'knowledge_channel_id', 'knowledge_channel_id TEXT');
        ensureColumn(dbInstance, 'guild_settings', 'setup_category_id', 'setup_category_id TEXT');

        dbInstance.prepare(`
            UPDATE projects
            SET workspace_id = 'default-workspace'
            WHERE workspace_id IS NULL OR trim(workspace_id) = ''
        `).run();
        dbInstance.prepare(`
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
        dbInstance.prepare(`
            UPDATE tasks
            SET assignee_user_id = assigned_to
            WHERE (assignee_user_id IS NULL OR trim(assignee_user_id) = '')
              AND assigned_to IS NOT NULL
              AND trim(assigned_to) <> ''
        `).run();

        const upsertSchemaVersion = dbInstance.prepare(`
            INSERT INTO db_meta (key, value)
            VALUES ('schema_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        upsertSchemaVersion.run(SCHEMA_VERSION);

        const schemaVersionRow = dbInstance.prepare('SELECT value FROM db_meta WHERE key = ?').get('schema_version');

        dbInfo('SQLite connected', { dbPath });
        dbInfo('Schema initialized', { schemaVersion: schemaVersionRow?.value || SCHEMA_VERSION });
        return dbInstance;
    } catch (err) {
        dbError('Database initialization failed', { error: err.message });
        throw err;
    }
}

function getDatabase() {
    if (!dbInstance) {
        return initializeDatabase();
    }

    return dbInstance;
}

module.exports = {
    initializeDatabase,
    getDatabase,
    SCHEMA_VERSION
};

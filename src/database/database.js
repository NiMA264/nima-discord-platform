const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { schemaStatements } = require('./schema');
const { dbInfo, dbError } = require('../utils/logger');

let dbInstance;
const SCHEMA_VERSION = '3';

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
            dbInstance.prepare(statement).run();
        }

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

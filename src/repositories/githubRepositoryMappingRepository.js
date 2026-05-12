const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    findByRepositoryFullName: db.prepare(`
        SELECT repository_full_name, workspace_id, created_at
        FROM github_repository_mappings
        WHERE lower(repository_full_name) = lower(?)
        LIMIT 1
    `),
    upsertMapping: db.prepare(`
        INSERT INTO github_repository_mappings (repository_full_name, workspace_id, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(repository_full_name) DO UPDATE SET
            workspace_id = excluded.workspace_id
    `)
};

function findWorkspaceIdByRepositoryFullName(repositoryFullName) {
    const row = statements.findByRepositoryFullName.get(String(repositoryFullName || ''));
    return row?.workspace_id || null;
}

function upsertRepositoryWorkspaceMapping({ repositoryFullName, workspaceId }) {
    return statements.upsertMapping.run(
        String(repositoryFullName || ''),
        String(workspaceId || ''),
        new Date().toISOString()
    );
}

module.exports = {
    findWorkspaceIdByRepositoryFullName,
    upsertRepositoryWorkspaceMapping
};

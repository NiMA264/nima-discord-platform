const { getDatabase } = require('../../database/database');

function upsertWorkspaceMembership({ workspaceId, userId, role }) {
    const db = getDatabase();
    const membershipRole = String(role || 'MEMBER').toUpperCase();
    db.prepare(`
        INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role
    `).run(workspaceId, userId, membershipRole, new Date().toISOString());

    return { workspaceId, userId, role: membershipRole };
}

function listWorkspaceMemberships(workspaceId) {
    const db = getDatabase();
    return db.prepare(`
        SELECT workspace_id AS workspaceId, user_id AS userId, role, created_at AS createdAt
        FROM workspace_memberships
        WHERE workspace_id = ?
        ORDER BY created_at ASC
    `).all(workspaceId);
}

module.exports = {
    upsertWorkspaceMembership,
    listWorkspaceMemberships
};


const { randomUUID } = require('crypto');
const { getDatabase } = require('../../database/database');

function normalizeSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'workspace';
}

function createWorkspace({ workspaceId, name, slug, createdAt }) {
    const db = getDatabase();
    const id = workspaceId || randomUUID();
    const workspaceName = String(name || 'Default Workspace').trim();
    const workspaceSlug = normalizeSlug(slug || workspaceName);
    const ts = createdAt || new Date().toISOString();

    db.prepare(`
        INSERT INTO workspaces (workspace_id, name, slug, created_at)
        VALUES (?, ?, ?, ?)
    `).run(id, workspaceName, workspaceSlug, ts);

    return { workspaceId: id, name: workspaceName, slug: workspaceSlug, createdAt: ts };
}

function findWorkspaceById(workspaceId) {
    const db = getDatabase();
    return db.prepare(`
        SELECT workspace_id AS workspaceId, name, slug, created_at AS createdAt
        FROM workspaces
        WHERE workspace_id = ?
    `).get(workspaceId) || null;
}

function listWorkspaces() {
    const db = getDatabase();
    return db.prepare(`
        SELECT workspace_id AS workspaceId, name, slug, created_at AS createdAt
        FROM workspaces
        ORDER BY created_at ASC
    `).all();
}

module.exports = {
    createWorkspace,
    findWorkspaceById,
    listWorkspaces,
    normalizeSlug
};


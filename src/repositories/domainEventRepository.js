const crypto = require('crypto');
const { getDatabase } = require('../database/database');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

function recordDomainEvent({ workspaceId: workspaceIdInput, type, entityType, entityId, metadata }) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const eventUid = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const db = getDatabase();

    db.prepare(`
        INSERT INTO domain_events (event_uid, workspace_id, type, entity_type, entity_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        eventUid,
        workspaceId,
        String(type || ''),
        String(entityType || ''),
        String(entityId || ''),
        JSON.stringify(metadata || {}),
        createdAt
    );

    return {
        eventUid,
        workspaceId,
        type: String(type || ''),
        entityType: String(entityType || ''),
        entityId: String(entityId || ''),
        metadata: metadata || {},
        createdAt
    };
}

function listDomainEventsByWorkspace(workspaceIdInput, limit = 100) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const db = getDatabase();
    const rows = db.prepare(`
        SELECT
            event_uid AS eventUid,
            workspace_id AS workspaceId,
            type,
            entity_type AS entityType,
            entity_id AS entityId,
            metadata,
            created_at AS createdAt
        FROM domain_events
        WHERE workspace_id = ?
        ORDER BY id DESC
        LIMIT ?
    `).all(workspaceId, limit);

    return rows.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
    }));
}

module.exports = {
    recordDomainEvent,
    listDomainEventsByWorkspace
};

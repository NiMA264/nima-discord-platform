const { getDatabase } = require('../database/database');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');
const { validateEventEnvelope } = require('../domain/events/eventEnvelopeSchema');
const metrics = require('../lib/metrics');
const { nowIso } = require('../lib/clock');
const { newUuid } = require('../lib/uuidProvider');
const { info } = require('../utils/logger');

function deriveSource(type) {
    const value = String(type || '').trim();
    if (!value) return 'system';
    const parts = value.split('.');
    return parts[0] || 'system';
}

function buildEventEnvelope(input = {}) {
    // New path: explicit envelope provided by producer.
    if (
        input.event_id
        || input.idempotency_key
        || input.occurred_at
        || input.workspace_id
        || input.source
    ) {
        return {
            event_id: String(input.event_id || '').trim(),
            idempotency_key: String(input.idempotency_key || '').trim(),
            type: String(input.type || '').trim(),
            version: Number(input.version || 1),
            occurred_at: String(input.occurred_at || '').trim(),
            workspace_id: String(input.workspace_id || '').trim(),
            source: String(input.source || deriveSource(input.type)).trim(),
            payload: input.payload || {}
        };
    }

    // Legacy path: adapt existing producer call shape.
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: input.workspaceId });
    const eventUid = newUuid();
    const occurredAt = nowIso();
    const type = String(input.type || '').trim();
    const payload = input.metadata || {};
    const source = deriveSource(type);
    const idempotencyKey = String(
        payload.deliveryId
            || payload.idempotencyKey
            || `${type}:${String(input.entityType || '')}:${String(input.entityId || '')}:${eventUid}`
    ).trim();

    return {
        event_id: eventUid,
        idempotency_key: idempotencyKey,
        type,
        version: 1,
        occurred_at: occurredAt,
        workspace_id: workspaceId,
        source,
        payload
    };
}

function assertValidEnvelope(envelope) {
    const result = validateEventEnvelope(envelope);
    if (result.valid) return;
    const err = new Error(`Domain event envelope validation failed: ${result.errors.join('; ')}`);
    err.code = 'DOMAIN_EVENT_ENVELOPE_INVALID';
    err.details = result.errors;
    throw err;
}

function mapDomainEventRow(row) {
    if (!row) return null;
    return {
        eventUid: row.event_uid,
        idempotencyKey: row.idempotency_key,
        workspaceId: row.workspace_id,
        type: row.type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: JSON.parse(row.metadata || '{}'),
        envelope: {
            event_id: row.event_uid,
            idempotency_key: row.idempotency_key,
            type: row.type,
            version: 1,
            occurred_at: row.created_at,
            workspace_id: row.workspace_id,
            source: deriveSource(row.type),
            payload: JSON.parse(row.metadata || '{}')
        },
        createdAt: row.created_at
    };
}

function findByEventUid(db, eventUid) {
    const row = db.prepare(`
        SELECT event_uid, idempotency_key, workspace_id, type, entity_type, entity_id, metadata, created_at
        FROM domain_events
        WHERE event_uid = ?
        LIMIT 1
    `).get(eventUid);
    return mapDomainEventRow(row);
}

function findByWorkspaceAndIdempotencyKey(db, workspaceId, idempotencyKey) {
    const row = db.prepare(`
        SELECT event_uid, idempotency_key, workspace_id, type, entity_type, entity_id, metadata, created_at
        FROM domain_events
        WHERE workspace_id = ? AND idempotency_key = ?
        LIMIT 1
    `).get(workspaceId, idempotencyKey);
    return mapDomainEventRow(row);
}

function markDeduped(result, reason) {
    metrics.increment('domain_event_deduplicated_total', 1, { reason });
    info('Domain event deduplicated', {
        reason,
        eventUid: result.eventUid,
        idempotencyKey: result.idempotencyKey,
        workspaceId: result.workspaceId,
        type: result.type
    });
    return {
        ...result,
        deduplicated: true,
        dedupeReason: reason
    };
}

function recordDomainEvent({
    workspaceId: workspaceIdInput,
    type,
    entityType,
    entityId,
    metadata,
    event_id,
    idempotency_key,
    version,
    occurred_at,
    workspace_id,
    source,
    payload
}) {
    const envelope = buildEventEnvelope({
        workspaceId: workspaceIdInput,
        type,
        entityType,
        entityId,
        metadata,
        event_id,
        idempotency_key,
        version,
        occurred_at,
        workspace_id,
        source,
        payload
    });
    assertValidEnvelope(envelope);

    const workspaceId = envelope.workspace_id;
    const eventUid = envelope.event_id;
    const createdAt = envelope.occurred_at;
    const db = getDatabase();
    const idempotencyKey = envelope.idempotency_key;

    const existingByEventId = findByEventUid(db, eventUid);
    if (existingByEventId) {
        return markDeduped(existingByEventId, 'event_id');
    }

    const existingByIdempotency = findByWorkspaceAndIdempotencyKey(db, workspaceId, idempotencyKey);
    if (existingByIdempotency) {
        return markDeduped(existingByIdempotency, 'idempotency_key');
    }

    db.prepare(`
        INSERT INTO domain_events (event_uid, idempotency_key, workspace_id, type, entity_type, entity_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        eventUid,
        idempotencyKey,
        workspaceId,
        String(envelope.type || ''),
        String(entityType || ''),
        String(entityId || ''),
        JSON.stringify(envelope.payload || {}),
        createdAt
    );

    metrics.increment('domain_event_persisted_total', 1, { source: envelope.source, type: envelope.type });

    return {
        eventUid,
        idempotencyKey,
        workspaceId,
        type: String(envelope.type || ''),
        entityType: String(entityType || ''),
        entityId: String(entityId || ''),
        metadata: envelope.payload || {},
        envelope,
        createdAt,
        deduplicated: false
    };
}

function listDomainEventsByWorkspace(workspaceIdInput, limit = 100) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const db = getDatabase();
    const rows = db.prepare(`
        SELECT
            event_uid AS eventUid,
            idempotency_key AS idempotencyKey,
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
    buildEventEnvelope,
    assertValidEnvelope,
    recordDomainEvent,
    listDomainEventsByWorkspace
};

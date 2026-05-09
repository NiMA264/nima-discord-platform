const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    enqueueGithub: db.prepare(`
        INSERT INTO github_webhook_events (guild_id, project_uid, event_name, delivery_id, payload, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'queued', ?)
    `),
    claimQueuedGithub: db.prepare(`
        SELECT id, guild_id, project_uid, event_name, delivery_id, payload
        FROM github_webhook_events
        WHERE status = 'queued'
        ORDER BY id ASC
        LIMIT ?
    `),
    markProcessingGithub: db.prepare(`
        UPDATE github_webhook_events
        SET status = 'processing'
        WHERE id = ?
    `),
    ackGithub: db.prepare(`
        UPDATE github_webhook_events
        SET status = 'processed', processed_at = ?
        WHERE id = ?
    `),
    failGithub: db.prepare(`
        UPDATE github_webhook_events
        SET status = 'failed', processed_at = ?
        WHERE id = ?
    `)
};

function assertQueueName(queueName) {
    if (queueName !== 'github_events') {
        throw new Error(`Unsupported queue: ${queueName}`);
    }
}

function enqueue(queueName, message, metadata = {}) {
    assertQueueName(queueName);

    return statements.enqueueGithub.run(
        metadata.guildId || null,
        metadata.projectId || null,
        metadata.eventName || null,
        metadata.deliveryId || null,
        JSON.stringify(message),
        metadata.createdAt || new Date().toISOString()
    );
}

function dequeue(queueName, limit = 20) {
    assertQueueName(queueName);

    const rows = statements.claimQueuedGithub.all(limit);
    for (const row of rows) {
        statements.markProcessingGithub.run(row.id);
    }

    return rows.map(row => ({
        id: row.id,
        queueName,
        payload: JSON.parse(row.payload),
        metadata: {
            guildId: row.guild_id,
            projectId: row.project_uid,
            eventName: row.event_name,
            deliveryId: row.delivery_id
        }
    }));
}

function ack(queueName, messageId) {
    assertQueueName(queueName);
    return statements.ackGithub.run(new Date().toISOString(), messageId);
}

function fail(queueName, messageId, errorMessage = null) {
    assertQueueName(queueName);
    return statements.failGithub.run(new Date().toISOString(), messageId);
}

module.exports = {
    enqueue,
    dequeue,
    ack,
    fail
};

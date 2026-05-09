const { getDatabase } = require('../../database/database');

const db = getDatabase();

const statements = {
    enqueue: db.prepare(`
        INSERT INTO github_webhook_events (guild_id, project_uid, event_name, delivery_id, payload, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'queued', ?)
    `),
    claimQueued: db.prepare(`
        SELECT id, guild_id, project_uid, event_name, delivery_id, payload
        FROM github_webhook_events
        WHERE status = 'queued'
        ORDER BY id ASC
        LIMIT ?
    `),
    markProcessed: db.prepare(`
        UPDATE github_webhook_events
        SET status = 'processed', processed_at = ?
        WHERE id = ?
    `)
};

function enqueueGithubEvent({ guildId, projectUid, eventName, deliveryId, payload, createdAt }) {
    return statements.enqueue.run(
        guildId || null,
        projectUid || null,
        eventName,
        deliveryId || null,
        JSON.stringify(payload),
        createdAt || new Date().toISOString()
    );
}

function claimQueuedEvents(limit = 20) {
    return statements.claimQueued.all(limit);
}

function markGithubEventProcessed(id) {
    return statements.markProcessed.run(new Date().toISOString(), id);
}

module.exports = {
    enqueueGithubEvent,
    claimQueuedEvents,
    markGithubEventProcessed
};

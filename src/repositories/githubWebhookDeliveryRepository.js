const { getDatabase } = require('../database/database');

function registerDelivery({ deliveryId, eventName, repositoryFullName, workspaceId, firstSeenAt }) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO github_webhook_delivery_dedupe (
            delivery_id, event_name, repository_full_name, workspace_id, first_seen_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(delivery_id) DO NOTHING
    `);

    const result = stmt.run(
        String(deliveryId || '').trim(),
        String(eventName || '').trim(),
        String(repositoryFullName || '').trim(),
        String(workspaceId || '').trim(),
        String(firstSeenAt || new Date().toISOString()).trim()
    );

    return {
        inserted: result.changes > 0
    };
}

module.exports = {
    registerDelivery
};

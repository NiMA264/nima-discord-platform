const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    getByWorkspace: db.prepare(`
        SELECT workspace_id, digest_channel_id
        FROM workspace_settings
        WHERE workspace_id = ?
        LIMIT 1
    `),
    upsertDigestChannel: db.prepare(`
        INSERT INTO workspace_settings (workspace_id, digest_channel_id)
        VALUES (?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
            digest_channel_id = excluded.digest_channel_id
    `)
};

function getWorkspaceSettings(workspaceId) {
    return statements.getByWorkspace.get(workspaceId) || null;
}

function upsertWorkspaceDigestChannel({ workspaceId, digestChannelId }) {
    return statements.upsertDigestChannel.run(workspaceId, digestChannelId || null);
}

module.exports = {
    getWorkspaceSettings,
    upsertWorkspaceDigestChannel
};

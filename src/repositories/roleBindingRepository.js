const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    findByGuildAndRole: db.prepare(`
        SELECT discord_role_id
        FROM role_bindings
        WHERE guild_id = ? AND project_role = ?
    `),
    listByGuild: db.prepare(`
        SELECT id, guild_id, discord_role_id, project_role
        FROM role_bindings
        WHERE guild_id = ?
        ORDER BY project_role ASC, discord_role_id ASC
    `),
    upsertBinding: db.prepare(`
        INSERT INTO role_bindings (guild_id, discord_role_id, project_role)
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id, discord_role_id)
        DO UPDATE SET project_role = excluded.project_role
    `),
    removeBinding: db.prepare(`
        DELETE FROM role_bindings
        WHERE guild_id = ? AND discord_role_id = ?
    `)
};

function getRoleBindingsForProjectRole(guildId, projectRole) {
    return statements.findByGuildAndRole.all(guildId, projectRole);
}

function listRoleBindingsByGuild(guildId) {
    return statements.listByGuild.all(guildId);
}

function upsertRoleBinding({ guildId, discordRoleId, projectRole }) {
    return statements.upsertBinding.run(guildId, discordRoleId, projectRole);
}

function removeRoleBinding({ guildId, discordRoleId }) {
    return statements.removeBinding.run(guildId, discordRoleId);
}

module.exports = {
    getRoleBindingsForProjectRole,
    listRoleBindingsByGuild,
    upsertRoleBinding,
    removeRoleBinding
};

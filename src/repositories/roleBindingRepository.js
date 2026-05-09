const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    findByGuildAndRole: db.prepare(`
        SELECT discord_role_id
        FROM role_bindings
        WHERE guild_id = ? AND project_role = ?
    `)
};

function getRoleBindingsForProjectRole(guildId, projectRole) {
    return statements.findByGuildAndRole.all(guildId, projectRole);
}

module.exports = {
    getRoleBindingsForProjectRole
};

const { PermissionFlagsBits } = require('discord.js');
const { findProjectByUid, findProjectMemberRole } = require('../repositories/projectRepository');
const { getRoleBindingsForProjectRole } = require('../repositories/roleBindingRepository');

function hasAdminBypass(interaction) {
    return Boolean(interaction?.member?.permissions?.has(PermissionFlagsBits.Administrator));
}

async function requireProjectRole({ interaction, projectId, allowed }) {
    if (hasAdminBypass(interaction)) {
        return { ok: true };
    }

    const project = await findProjectByUid(projectId);
    if (!project || project.guild_id !== interaction.guild.id) {
        return { ok: false, reason: 'Project not found.' };
    }

    const memberRole = await findProjectMemberRole(projectId, interaction.user.id);
    if (memberRole && allowed.includes(memberRole)) {
        return { ok: true };
    }

    for (const roleName of allowed) {
        const bindings = getRoleBindingsForProjectRole(interaction.guild.id, roleName);
        if (!bindings.length) continue;

        const hasDiscordRole = bindings.some(binding => interaction.member.roles.cache.has(binding.discord_role_id));
        if (hasDiscordRole) {
            return { ok: true };
        }
    }

    return {
        ok: false,
        reason: `Missing required role (${allowed.join(', ')})`
    };
}

module.exports = {
    requireProjectRole
};

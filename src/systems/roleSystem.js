const { createRoleMenuRow } = require('../components/selectMenus/roleMenu');
const { createEmbed } = require('../utils/embed');
const { safeReply } = require('../utils/discord');
const { findRole, findTextChannel } = require('../utils/resolvers');

async function ensureRole(guild, name) {
    let role = findRole(guild, name);
    if (role) return { role, created: false };

    role = await guild.roles.create({ name });
    return { role, created: true };
}

async function postRolePanel(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.roles);
    if (!channel) {
        return {
            createdRoles: [],
            errorMessage: `Role-Channel "${config.channels.channels.roles}" nicht gefunden.`
        };
    }

    const roleNames = [config.roles.coder, config.roles.projectLead];
    const createdRoles = [];
    const roleOptions = [];

    for (const name of roleNames) {
        const { role, created } = await ensureRole(guild, name);
        if (created) createdRoles.push(role.name);

        roleOptions.push({
            label: role.name,
            value: role.id,
            description: `${role.name} role`
        });
    }

    if (!roleOptions.length) {
        return {
            createdRoles,
            errorMessage: 'Keine Rollenoptionen konnten erstellt werden.'
        };
    }

    const embed = createEmbed('Rollen wählen', 'Wähle deine Community-Rollen über das Menü.');
    await channel.send({ embeds: [embed], components: [createRoleMenuRow(roleOptions)] });

    return { createdRoles, errorMessage: null };
}

async function applyRoleSelection(interaction) {
    const selected = interaction.values;
    const allRoleIds = interaction.component.options.map(option => option.value);

    for (const roleId of allRoleIds) {
        if (selected.includes(roleId)) {
            if (!interaction.member.roles.cache.has(roleId)) {
                await interaction.member.roles.add(roleId);
            }
            continue;
        }

        if (interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId);
        }
    }

    await safeReply(interaction, { content: 'Rollen aktualisiert.', flags: 64 });
}

module.exports = { postRolePanel, applyRoleSelection };

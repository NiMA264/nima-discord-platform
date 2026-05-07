const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function createRoleMenuRow(options) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('role_select')
        .setPlaceholder('Wähle deine Rollen')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = { createRoleMenuRow };

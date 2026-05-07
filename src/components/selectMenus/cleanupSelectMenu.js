const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function createCleanupSelectMenuRow(options) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('cleanup_select_channels')
        .setPlaceholder('Wähle sichere Cleanup-Kandidaten')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options.slice(0, 25));

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = { createCleanupSelectMenuRow };

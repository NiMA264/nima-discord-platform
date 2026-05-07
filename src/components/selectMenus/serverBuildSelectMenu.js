const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function createServerBuildSelectMenuRow() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('server_build_select')
        .setPlaceholder('Wähle Serverbereiche')
        .addOptions(
            { label: 'Start/Info', value: 'build_info' },
            { label: 'Coding', value: 'build_coding' },
            { label: 'Projekte', value: 'build_projects' },
            { label: 'Support', value: 'build_support' },
            { label: 'Community', value: 'build_community' },
            { label: 'Team/Logs', value: 'build_logs' },
            { label: 'Alles', value: 'build_all' }
        );

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = { createServerBuildSelectMenuRow };

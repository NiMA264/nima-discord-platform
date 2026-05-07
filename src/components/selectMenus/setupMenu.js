const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function createSetupMenuRow() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('setup_action_menu')
        .setPlaceholder('Wähle Setup Action')
        .addOptions(
            { label: 'Server Build', value: 'build' },
            { label: 'Regeln posten', value: 'rules' },
            { label: 'Welcome Panel', value: 'welcome' },
            { label: 'Role Panel', value: 'roles' },
            { label: 'Ticket Panel', value: 'tickets' },
            { label: 'Project Panel', value: 'projects' },
            { label: 'Server Info', value: 'server_info' },
            { label: 'Coding Guidelines', value: 'coding_guidelines' },
            { label: 'AI Help', value: 'ai_help' },
            { label: 'Announcement', value: 'announcement' }
        );

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = { createSetupMenuRow };

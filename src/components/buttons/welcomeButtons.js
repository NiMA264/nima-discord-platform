const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createWelcomeButtonRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('welcome_access_server').setLabel('Access Server').setStyle(ButtonStyle.Primary)
    );
}

module.exports = { createWelcomeButtonRow };

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function createAnnouncementModal() {
    return new ModalBuilder()
        .setCustomId('announcement_create_modal')
        .setTitle('Ankündigung erstellen')
        .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('announcement_title').setLabel('Titel').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('announcement_description').setLabel('Beschreibung').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('announcement_category').setLabel('Kategorie (community/events/projects/...)').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('announcement_importance').setLabel('Wichtigkeit (low/normal/high/critical)').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('announcement_ping_role').setLabel('Optionale Ping-Rolle (Name)').setStyle(TextInputStyle.Short).setRequired(false))
        );
}

module.exports = { createAnnouncementModal };

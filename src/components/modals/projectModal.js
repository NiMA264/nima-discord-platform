const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function createProjectModal() {
    return new ModalBuilder()
        .setCustomId('project_create_modal')
        .setTitle('Projekt erstellen')
        .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_name').setLabel('Name').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_description').setLabel('Beschreibung').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_status').setLabel('Status').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_type').setLabel('Typ').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_stack').setLabel('Tech Stack').setStyle(TextInputStyle.Short).setRequired(false))
        );
}

function createProjectLogModal() {
    return new ModalBuilder()
        .setCustomId('project_log_modal')
        .setTitle('Projekt Log Eintrag')
        .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_name_for_log').setLabel('Projektname').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('project_log_entry').setLabel('Log Eintrag').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
}

module.exports = { createProjectModal, createProjectLogModal };

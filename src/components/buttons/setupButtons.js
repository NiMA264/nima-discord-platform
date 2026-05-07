const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createSetupButtonsRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_build_server').setLabel('Server Builder').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('setup_post_rules').setLabel('Regeln').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_post_welcome').setLabel('Welcome').setStyle(ButtonStyle.Secondary)
    );
}

function createSetupButtonsRow2() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_post_roles').setLabel('Rollen').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_post_tickets').setLabel('Tickets').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_post_projects').setLabel('Projekte').setStyle(ButtonStyle.Secondary)
    );
}

function createSetupButtonsRow3() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_post_server_info').setLabel('Server-Info').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_post_coding_guidelines').setLabel('Coding-Guidelines').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_post_ai_help').setLabel('AI-Hilfe').setStyle(ButtonStyle.Secondary)
    );
}

function createSetupButtonsRow4() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_cleanup_dry_run').setLabel('Cleanup prüfen').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_cleanup_execute').setLabel('Cleanup ausführen').setStyle(ButtonStyle.Danger)
    );
}

function createCleanupConfirmButtonsRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cleanup_confirm_selected').setLabel('Ausgewählte wirklich löschen').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cleanup_cancel_selected').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary)
    );
}

function createSetupProjectsRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_project_create').setLabel('Projekt erstellen').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup_project_log').setLabel('Projekt-Log').setStyle(ButtonStyle.Primary)
    );
}

module.exports = {
    createSetupButtonsRow,
    createSetupButtonsRow2,
    createSetupButtonsRow3,
    createSetupButtonsRow4,
    createCleanupConfirmButtonsRow,
    createSetupProjectsRow
};

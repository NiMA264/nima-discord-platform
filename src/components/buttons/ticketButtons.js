const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createTicketPanelRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open_modal').setLabel('Ticket öffnen').setStyle(ButtonStyle.Primary)
    );
}

function createTicketCloseRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Ticket schließen').setStyle(ButtonStyle.Danger)
    );
}

function createTicketCloseConfirmRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Schließen bestätigen').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary)
    );
}

module.exports = { createTicketPanelRow, createTicketCloseRow, createTicketCloseConfirmRow };

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function createTicketModal() {
    return new ModalBuilder()
        .setCustomId('ticket_create_modal')
        .setTitle('Neues Ticket')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('ticket_subject').setLabel('Betreff').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('ticket_details').setLabel('Details').setStyle(TextInputStyle.Paragraph).setRequired(true)
            )
        );
}

module.exports = { createTicketModal };

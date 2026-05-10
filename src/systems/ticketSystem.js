const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { createTicketPanelRow, createTicketCloseRow, createTicketCloseConfirmRow } = require('../components/buttons/ticketButtons');
const { createEmbed } = require('../utils/embed');
const { hasTicketStaffPermission } = require('../utils/permissions');
const { safeReply } = require('../utils/discord');
const { findCategory, findRole, findTextChannel } = require('../utils/resolvers');
const { logTicketEvent } = require('./logSystem');
const {
    createTicket,
    findOpenTicketByOwner,
    closeTicketByChannelId,
    findTicketByChannelId,
    insertTicketTranscriptMeta
} = require('../repositories/ticketRepository');
const { getGuildChannelConfig } = require('../services/guildChannelConfigService');
const { ticketInfo, ticketWarn } = require('../utils/logger');

function sanitizeChannelPart(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 32);
}

function createTranscriptSnapshot(channel) {
    const transcriptDate = new Date().toISOString();
    return {
        ticketId: channel.id,
        channelName: channel.name,
        closedAt: transcriptDate,
        transcriptState: 'prepared'
    };
}

function getSupportRoles(guild, config) {
    return [config.roles.admin, config.roles.support]
        .filter(Boolean)
        .map(name => findRole(guild, name))
        .filter(Boolean);
}

async function postTicketPanel(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.tickets);
    if (!channel) return;

    await channel.send({
        embeds: [createEmbed('Support Tickets', 'Nutze den Button, um ein privates Ticket zu erstellen.')],
        components: [createTicketPanelRow()]
    });
}

async function createTicketFromModal(interaction, config) {
    const subject = interaction.fields.getTextInputValue('ticket_subject').trim();
    const details = interaction.fields.getTextInputValue('ticket_details').trim();

    const openTicket = findOpenTicketByOwner(interaction.guild.id, interaction.user.id);
    if (openTicket) {
        const existingChannel = interaction.guild.channels.cache.get(openTicket.channel_id);
        if (existingChannel) {
            return safeReply(interaction, { content: `Du hast bereits ein offenes Ticket: ${existingChannel}`, flags: 64 });
        }

        closeTicketByChannelId({
            guildId: interaction.guild.id,
            channelId: openTicket.channel_id,
            closedAt: new Date().toISOString(),
            closedBy: 'system-cleanup'
        });
        ticketWarn('Closed stale open ticket row', { guildId: interaction.guild.id, channelId: openTicket.channel_id, ownerId: interaction.user.id });
    }

    const settings = getGuildChannelConfig(interaction.guild.id);
    const category = findCategory(interaction.guild, config.channels.categories.support, settings.setupCategoryId);

    const supportRoles = getSupportRoles(interaction.guild, config);
    const permissionOverwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ];

    for (const role of supportRoles) {
        permissionOverwrites.push({
            id: role.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
    }

    const channel = await interaction.guild.channels.create({
        name: `ticket-${sanitizeChannelPart(interaction.user.username)}`,
        topic: `ticket-owner:${interaction.user.id} | subject:${subject.slice(0, 80)}`,
        type: ChannelType.GuildText,
        parent: category?.id,
        permissionOverwrites
    });

    createTicket({
        guildId: interaction.guild.id,
        channelId: channel.id,
        ownerId: interaction.user.id,
        subject,
        createdAt: new Date().toISOString()
    });

    await channel.send({
        embeds: [createEmbed(`Ticket: ${subject}`, details)],
        components: [createTicketCloseRow()]
    });

    ticketInfo('Ticket persisted', { guildId: interaction.guild.id, channelId: channel.id, ownerId: interaction.user.id });
    await logTicketEvent(interaction.guild, config, `created by ${interaction.user.tag} | channel=${channel.name}(${channel.id})`);
    await safeReply(interaction, { content: `Ticket erstellt: ${channel}`, flags: 64 });
}

async function requestTicketClose(interaction) {
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;

    if (!hasTicketStaffPermission(interaction.member)) {
        return safeReply(interaction, { content: 'Nur Support/Admin darf Tickets schließen.', flags: 64 });
    }

    return safeReply(interaction, {
        content: 'Ticket wirklich schließen?',
        components: [createTicketCloseConfirmRow()],
        flags: 64
    });
}

async function cancelTicketClose(interaction) {
    return safeReply(interaction, { content: 'Ticket-Schließen abgebrochen.', flags: 64 });
}

async function confirmTicketClose(interaction, config) {
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;

    if (!hasTicketStaffPermission(interaction.member)) {
        return safeReply(interaction, { content: 'Nur Support/Admin darf Tickets schließen.', flags: 64 });
    }

    const closedAt = new Date().toISOString();
    const ticketRecord = findTicketByChannelId(interaction.guild.id, interaction.channel.id);

    closeTicketByChannelId({
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        closedAt,
        closedBy: interaction.user.id
    });

    const transcriptSnapshot = createTranscriptSnapshot(interaction.channel);
    if (ticketRecord) {
        insertTicketTranscriptMeta({
            ticketId: ticketRecord.id,
            channelId: interaction.channel.id,
            metadata: JSON.stringify(transcriptSnapshot),
            createdAt: closedAt
        });
    }

    await logTicketEvent(interaction.guild, config, `closed by ${interaction.user.tag} | channel=${interaction.channel.name}(${interaction.channel.id}) | transcriptMetaSaved=true`);
    await safeReply(interaction, { content: 'Ticket wird geschlossen...', flags: 64 });
    await interaction.channel.delete('Ticket closed');
}

module.exports = {
    postTicketPanel,
    createTicketFromModal,
    requestTicketClose,
    confirmTicketClose,
    cancelTicketClose
};

const { AttachmentBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embed');
const { findTextChannel, findRole } = require('../utils/resolvers');
const rules = require('../config/content/rules');
const announcementsConfig = require('../config/content/announcements');
const serverInfo = require('../config/content/serverInfo');
const codingGuidelines = require('../config/content/codingGuidelines');
const projectGuidelines = require('../config/content/projectGuidelines');
const ticketGuidelines = require('../config/content/ticketGuidelines');
const { createAnnouncement } = require('../repositories/announcementRepository');
const { resolveAssetPath } = require('./assets');

function createListDescription(items) {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

async function postRules(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.rules);
    if (!channel) return false;

    const embed = createEmbed(rules.title, `${rules.intro}\n\n${createListDescription(rules.items)}`, config.theme.primaryColor)
        .setFooter({ text: rules.footer });

    await channel.send({ embeds: [embed] });
    return true;
}

async function postServerInfo(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.welcome);
    if (!channel) return false;

    const embed = createEmbed(serverInfo.title, serverInfo.body.join('\n\n'), config.theme.primaryColor);
    await channel.send({ embeds: [embed] });
    return true;
}

async function postCodingGuidelines(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.codingGeneral);
    if (!channel) return false;

    const embed = createEmbed(codingGuidelines.title, createListDescription(codingGuidelines.items), config.theme.primaryColor);
    await channel.send({ embeds: [embed] });
    return true;
}

async function postAiHelpInfo(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.aiHelp) || findTextChannel(guild, config.channels.channels.codingGeneral);
    if (!channel) return false;

    const embed = createEmbed('🤖 AI Hilfe', [
        'Erwähne den Bot oder schreibe "help" im KI-Hilfe-Kanal.',
        'Nutze Codeblöcke und poste die genaue Fehlermeldung.',
        'Beschreibe kurz, was du erwartest und was tatsächlich passiert.'
    ].join('\n'), config.theme.primaryColor);

    await channel.send({ embeds: [embed] });
    return true;
}

async function postProjectGuidelines(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.projectLogs);
    if (!channel) return false;

    const embed = createEmbed(projectGuidelines.title, createListDescription(projectGuidelines.items), config.theme.primaryColor);
    await channel.send({ embeds: [embed] });
    return true;
}

async function postTicketGuidelines(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.tickets);
    if (!channel) return false;

    const embed = createEmbed(ticketGuidelines.title, createListDescription(ticketGuidelines.items), config.theme.primaryColor);
    await channel.send({ embeds: [embed] });
    return true;
}

async function postAnnouncement(guild, config, author, payload) {
    const channel = findTextChannel(guild, config.channels.channels.announcements);
    if (!channel) return { ok: false, reason: 'Announcement channel not found' };

    const normalizedImportance = String(payload.importance || announcementsConfig.defaults.importance).toLowerCase();
    const color = announcementsConfig.importanceColors[normalizedImportance] || announcementsConfig.importanceColors.normal;

    const embed = createEmbed(payload.title || announcementsConfig.defaults.title, payload.description || announcementsConfig.defaults.description, color)
        .addFields(
            { name: 'Kategorie', value: payload.category || announcementsConfig.defaults.category, inline: true },
            { name: 'Wichtigkeit', value: normalizedImportance, inline: true }
        )
        .setFooter({ text: `Angekündigt von ${author.tag}` });

    const files = [];
    const welcomePath = resolveAssetPath('welcome.png');
    if (welcomePath) {
        files.push(new AttachmentBuilder(welcomePath));
        embed.setImage('attachment://welcome.png');
    }

    const role = payload.pingRoleName ? findRole(guild, payload.pingRoleName) : null;
    const pingContent = role ? `<@&${role.id}>` : null;

    const message = await channel.send({
        content: pingContent || undefined,
        embeds: [embed],
        files
    });

    createAnnouncement({
        guildId: guild.id,
        channelId: channel.id,
        messageId: message.id,
        authorId: author.id,
        title: payload.title || announcementsConfig.defaults.title,
        category: payload.category || announcementsConfig.defaults.category,
        importance: normalizedImportance,
        createdAt: new Date().toISOString()
    });

    return { ok: true, message };
}

module.exports = {
    postRules,
    postServerInfo,
    postCodingGuidelines,
    postAiHelpInfo,
    postProjectGuidelines,
    postTicketGuidelines,
    postAnnouncement
};

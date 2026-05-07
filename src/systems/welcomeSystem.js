const { AttachmentBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embed');
const { createWelcomeButtonRow } = require('../components/buttons/welcomeButtons');
const { findTextChannel } = require('../utils/resolvers');
const { resolveAssetPath } = require('./assets');

async function postWelcomePanel(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.welcome);
    if (!channel) return null;

    const welcomePath = resolveAssetPath('welcome.png');
    const files = [];
    const embed = createEmbed('Welcome to NiMa Labs', 'Klicke auf den Button, um Zugriff zu erhalten.');

    if (welcomePath) {
        files.push(new AttachmentBuilder(welcomePath));
        embed.setImage('attachment://welcome.png');
    }

    await channel.send({ embeds: [embed], components: [createWelcomeButtonRow()], files });
    return embed;
}

async function sendMemberWelcome(member, config) {
    const channel = findTextChannel(member.guild, config.channels.channels.welcome);
    if (!channel) return;

    const welcomePath = resolveAssetPath('welcome.png');
    const files = [];
    const embed = createEmbed('Welcome to NiMa Labs', `Willkommen ${member}, klicke auf den Button für Serverzugriff.`);

    if (welcomePath) {
        files.push(new AttachmentBuilder(welcomePath));
        embed.setImage('attachment://welcome.png');
    }

    await channel.send({ embeds: [embed], components: [createWelcomeButtonRow()], files });
}

module.exports = { postWelcomePanel, sendMemberWelcome };

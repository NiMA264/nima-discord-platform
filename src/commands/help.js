const { SlashCommandBuilder } = require('discord.js');
const { hasManageGuildPermission } = require('../utils/permissions');
const { hasGuildProjectLeadOrMaintainerRole } = require('../repositories/projectRepository');
const { getGuildChannelConfig } = require('../services/guildChannelConfigService');
const { findTextChannel } = require('../utils/resolvers');
const { buildBotHelpGuide } = require('../content/botHelpGuide');

async function canPublishHelp(interaction) {
    if (hasManageGuildPermission(interaction.member)) return true;
    return hasGuildProjectLeadOrMaintainerRole(interaction.guildId, interaction.user.id);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Help and onboarding commands')
        .addSubcommand(sub =>
            sub
                .setName('publish')
                .setDescription('Publish bot help guide into configured help channel')
        ),
    async execute(interaction, config) {
        const allowed = await canPublishHelp(interaction);
        if (!allowed) {
            await interaction.reply({ content: 'Nur Admin oder PROJECT_LEAD/MAINTAINER darf /help publish ausfuehren.', flags: 64 });
            return;
        }

        const settings = getGuildChannelConfig(interaction.guildId);
        const target = findTextChannel(interaction.guild, '', settings.helpChannelId) || interaction.channel;
        const guide = buildBotHelpGuide();

        await target.send({ content: `\`\`\`txt\n${guide}\n\`\`\`` });
        await interaction.reply({
            content: `Guide gepostet in ${target}.`,
            flags: 64
        });
    }
};

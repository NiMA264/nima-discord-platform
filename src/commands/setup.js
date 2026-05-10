const { ChannelType, SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embed');
const { createSetupButtonsRow, createSetupButtonsRow2, createSetupButtonsRow3, createSetupButtonsRow4 } = require('../components/buttons/setupButtons');
const { createSetupMenuRow } = require('../components/selectMenus/setupMenu');
const { hasManageGuildPermission } = require('../utils/permissions');
const { upsertGuildChannelSettings } = require('../repositories/guildSettingsRepository');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Open NiMa Labs setup panel')
        .addSubcommand(sub =>
            sub
                .setName('panel')
                .setDescription('Open setup panel')
        )
        .addSubcommand(sub =>
            sub
                .setName('channels')
                .setDescription('Configure core channel bindings (ID-first)')
                .addChannelOption(option =>
                    option
                        .setName('setup_category')
                        .setDescription('Setup category')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('welcome_channel')
                        .setDescription('Welcome channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('bot_channel')
                        .setDescription('Bot channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('help_channel')
                        .setDescription('Help/guide channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('project_forum_channel')
                        .setDescription('Project forum channel')
                        .addChannelTypes(ChannelType.GuildForum)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('knowledge_channel')
                        .setDescription('Optional knowledge channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),
    async execute(interaction) {
        if (!hasManageGuildPermission(interaction.member)) {
            await interaction.reply({ content: 'Nur Admins duerfen Setup-Aktionen ausfuehren.', flags: 64 });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'channels') {
            const setupCategory = interaction.options.getChannel('setup_category', true);
            const welcomeChannel = interaction.options.getChannel('welcome_channel', true);
            const botChannel = interaction.options.getChannel('bot_channel', true);
            const helpChannel = interaction.options.getChannel('help_channel', false);
            const projectForumChannel = interaction.options.getChannel('project_forum_channel', true);
            const knowledgeChannel = interaction.options.getChannel('knowledge_channel', false);

            upsertGuildChannelSettings({
                guildId: interaction.guildId,
                setupCategoryId: setupCategory.id,
                welcomeChannelId: welcomeChannel.id,
                botChannelId: botChannel.id,
                helpChannelId: helpChannel?.id || null,
                projectForumChannelId: projectForumChannel.id,
                knowledgeChannelId: knowledgeChannel?.id || null
            });

            const lines = [
                'Setup channels gespeichert (ID-first):',
                `- setupCategoryId: ${setupCategory.id} (${setupCategory.name})`,
                `- welcomeChannelId: ${welcomeChannel.id} (${welcomeChannel.name})`,
                `- botChannelId: ${botChannel.id} (${botChannel.name})`,
                `- helpChannelId: ${helpChannel?.id || 'none'}${helpChannel ? ` (${helpChannel.name})` : ''}`,
                `- projectForumChannelId: ${projectForumChannel.id} (${projectForumChannel.name})`,
                `- knowledgeChannelId: ${knowledgeChannel?.id || 'none'}${knowledgeChannel ? ` (${knowledgeChannel.name})` : ''}`
            ];

            await interaction.reply({ content: lines.join('\n'), flags: 64 });
            return;
        }

        const embed = createEmbed('NiMa Labs Admin Setup', 'Verwalte den Server ueber Buttons, Select Menus und Modals.');
        await interaction.reply({
            embeds: [embed],
            components: [createSetupButtonsRow(), createSetupButtonsRow2(), createSetupButtonsRow3(), createSetupButtonsRow4(), createSetupMenuRow()],
            flags: 64
        });
    }
};

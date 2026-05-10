const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { summarizeCurrentThread } = require('../systems/knowledgeSystem');
const { createKnowledgeExcerpt, embedSafeText } = require('../utils/knowledgeFormatting');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('thread-summary')
        .setDescription('Erstellt eine Zusammenfassung des aktuellen Threads'),
    async execute(interaction, config) {
        await interaction.deferReply({ flags: 64 });
        const result = await summarizeCurrentThread(interaction, config);
        if (!result.ok) {
            await interaction.editReply({ content: result.reason });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Thread Summary')
            .setDescription(embedSafeText(createKnowledgeExcerpt(result.summary, 3500), 4000))
            .setFooter({ text: `Thread: ${interaction.channel?.name || interaction.channelId}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};

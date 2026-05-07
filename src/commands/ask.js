const { SlashCommandBuilder } = require('discord.js');
const { askFromKnowledge, buildSourceHints } = require('../systems/knowledgeSystem');
const { truncateText } = require('../utils/message');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Stellt eine Frage basierend auf lokalem Community-Wissen')
        .addStringOption(option =>
            option
                .setName('question')
                .setDescription('Deine Frage')
                .setRequired(true)
        ),
    async execute(interaction, config) {
        const question = interaction.options.getString('question', true).trim();
        await interaction.deferReply({ flags: 64 });

        const result = await askFromKnowledge(config, interaction.guildId, question);
        const sources = result.sources?.length
            ? `\n\nQuellen:\n${buildSourceHints(result.sources)}`
            : '';

        await interaction.editReply({
            content: truncateText(`${result.answer}${sources}`, 1900)
        });
    }
};

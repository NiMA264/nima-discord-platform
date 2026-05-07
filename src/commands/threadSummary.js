const { SlashCommandBuilder } = require('discord.js');
const { summarizeCurrentThread } = require('../systems/knowledgeSystem');

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

        await interaction.editReply({ content: result.summary });
    }
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { askFromKnowledge, registerAskResponseContext } = require('../systems/knowledgeSystem');
const {
    createKnowledgeExcerpt,
    formatConfidenceLabel,
    formatAcceptedMarker,
    formatSourceLine,
    embedSafeText
} = require('../utils/knowledgeFormatting');

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
        const askContextId = registerAskResponseContext(interaction, question, result);
        const sourceEntries = (result.sources || [])
            .slice()
            .sort((a, b) => Number(b.retrieval_score || 0) - Number(a.retrieval_score || 0))
            .slice(0, 5);

        const channelNameById = {};
        const threadNameById = {};
        for (const channel of interaction.guild?.channels?.cache?.values?.() || []) {
            channelNameById[channel.id] = channel.name;
            threadNameById[channel.id] = channel.name;
        }

        const sourceLines = sourceEntries.map((entry, index) => {
            const accepted = formatAcceptedMarker(Boolean(entry.is_accepted_solution));
            const score = Number(entry.retrieval_score || 0).toFixed(2);
            return `${index + 1}. ${accepted} | score=${score}\n${formatSourceLine(entry, {
                guildId: interaction.guildId,
                channelNameById,
                threadNameById
            })}`;
        });

        const embed = new EmbedBuilder()
            .setTitle('Knowledge Answer')
            .setDescription(embedSafeText(createKnowledgeExcerpt(result.answer, 1200), 3500))
            .addFields(
                { name: 'Confidence', value: formatConfidenceLabel(result.confidence), inline: true },
                { name: 'Frage', value: embedSafeText(createKnowledgeExcerpt(question, 220), 1024), inline: false }
            )
            .setFooter({ text: sourceEntries.length ? `Quellen: ${sourceEntries.length}` : 'Keine Quellen gefunden' })
            .setTimestamp();

        if ((result.confidence || '').toLowerCase() === 'low') {
            embed.addFields({
                name: 'Hinweis',
                value: 'Niedrige Confidence. Bitte zusätzliche technische Details liefern (Code, Fehler, Stacktrace).',
                inline: false
            });
        }

        if (sourceLines.length) {
            embed.addFields({
                name: 'Quellen',
                value: embedSafeText(sourceLines.join('\n\n'), 1024),
                inline: false
            });
        }

        const feedbackRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`knowledge_feedback_helpful:${askContextId}`)
                .setLabel('Helpful')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`knowledge_feedback_not_helpful:${askContextId}`)
                .setLabel('Not helpful')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`knowledge_feedback_outdated:${askContextId}`)
                .setLabel('Mark source as outdated')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ embeds: [embed], components: [feedbackRow] });
    }
};

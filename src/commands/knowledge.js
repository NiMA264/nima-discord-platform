const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
    acceptKnowledgeSolution,
    getKnowledgeEntryDetails,
    unacceptKnowledgeSolution,
    listKnowledgeEntriesForCuration,
    handleKnowledgeFeedbackList,
    handleKnowledgeFeedbackReview,
    handleKnowledgeHealth
} = require('../systems/knowledgeSystem');
const {
    formatKnowledgeId,
    createKnowledgeExcerpt,
    formatAcceptedMarker,
    formatIsoTimestamp,
    formatSourceLine,
    embedSafeText
} = require('../utils/knowledgeFormatting');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('knowledge')
        .setDescription('Knowledge Engine Aktionen')
        .addSubcommand(sub =>
            sub
                .setName('accept')
                .setDescription('Markiert einen Knowledge Entry als Accepted Solution')
                .addStringOption(option =>
                    option
                        .setName('entry_id')
                        .setDescription('ID des Knowledge Entries')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Optionaler Grund')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('show')
                .setDescription('Zeigt Details eines Knowledge Entries')
                .addStringOption(option =>
                    option
                        .setName('entry_id')
                        .setDescription('ID des Knowledge Entries')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('unaccept')
                .setDescription('Setzt eine Accepted Solution zurueck')
                .addStringOption(option =>
                    option
                        .setName('entry_id')
                        .setDescription('ID des Knowledge Entries')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Optionaler Grund')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Listet Knowledge Entries fuer Curation auf')
                .addStringOption(option =>
                    option
                        .setName('filter')
                        .setDescription('Filter fuer die Ausgabe')
                        .setRequired(false)
                        .addChoices(
                            { name: 'recent', value: 'recent' },
                            { name: 'accepted', value: 'accepted' },
                            { name: 'unaccepted', value: 'unaccepted' },
                            { name: 'thread', value: 'thread' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Maximale Anzahl Eintraege')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(25)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('feedback')
                .setDescription('Zeigt Ask-Feedback fuer Moderation/Curation')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Feedback-Typ')
                        .setRequired(false)
                        .addChoices(
                            { name: 'outdated', value: 'outdated' },
                            { name: 'not_helpful', value: 'not_helpful' },
                            { name: 'helpful', value: 'helpful' },
                            { name: 'all', value: 'all' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Maximale Anzahl Feedback-Items')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(25)
                )
                .addStringOption(option =>
                    option
                        .setName('status')
                        .setDescription('Review-Status')
                        .setRequired(false)
                        .addChoices(
                            { name: 'open', value: 'open' },
                            { name: 'reviewed', value: 'reviewed' },
                            { name: 'resolved', value: 'resolved' },
                            { name: 'ignored', value: 'ignored' },
                            { name: 'all', value: 'all' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('review-feedback')
                .setDescription('Setzt den Triage-Status eines Ask-Feedback-Items')
                .addStringOption(option =>
                    option
                        .setName('ask_context_id')
                        .setDescription('Ask Context ID')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Feedback-Typ')
                        .setRequired(true)
                        .addChoices(
                            { name: 'outdated', value: 'outdated' },
                            { name: 'not_helpful', value: 'not_helpful' },
                            { name: 'helpful', value: 'helpful' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('status')
                        .setDescription('Neuer Status')
                        .setRequired(true)
                        .addChoices(
                            { name: 'open', value: 'open' },
                            { name: 'reviewed', value: 'reviewed' },
                            { name: 'resolved', value: 'resolved' },
                            { name: 'ignored', value: 'ignored' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('note')
                        .setDescription('Optionale Notiz')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('health')
                .setDescription('Zeigt das Knowledge Health Dashboard')
                .addStringOption(option =>
                    option
                        .setName('window')
                        .setDescription('Zeitfenster')
                        .setRequired(false)
                        .addChoices(
                            { name: '24h', value: '24h' },
                            { name: '7d', value: '7d' },
                            { name: '30d', value: '30d' },
                            { name: 'all', value: 'all' }
                        )
                )
        ),
    async execute(interaction, config) {
        const channelNameById = {};
        const threadNameById = {};
        for (const channel of interaction.guild?.channels?.cache?.values?.() || []) {
            channelNameById[channel.id] = channel.name;
            threadNameById[channel.id] = channel.name;
        }

        const sub = interaction.options.getSubcommand();
        if (sub === 'accept') {
            const entryId = interaction.options.getString('entry_id', true);
            const reason = interaction.options.getString('reason') || '';
            const result = await acceptKnowledgeSolution(interaction, config, { entryId, reason });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle('Knowledge Accepted')
                .setDescription(result.message)
                .addFields(
                    { name: 'Entry', value: formatKnowledgeId(result.entryId), inline: true },
                    { name: 'Accepted By', value: `<@${result.acceptedBy}>`, inline: true }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (sub === 'show') {
            const entryId = interaction.options.getString('entry_id', true);
            const result = getKnowledgeEntryDetails(interaction, { entryId });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }
            const entry = result.entry;
            const embed = new EmbedBuilder()
                .setTitle(`Knowledge Entry ${formatKnowledgeId(entry.id)}`)
                .setDescription(embedSafeText(createKnowledgeExcerpt(entry.title || entry.content, 300), 4096))
                .addFields(
                    { name: 'Status', value: formatAcceptedMarker(Boolean(entry.is_accepted_solution)), inline: true },
                    { name: 'Created', value: formatIsoTimestamp(entry.created_at), inline: true },
                    { name: 'Accepted At', value: formatIsoTimestamp(entry.accepted_at), inline: true },
                    { name: 'Accepted By', value: entry.accepted_by ? `<@${entry.accepted_by}>` : 'n/a', inline: true },
                    { name: 'Source', value: embedSafeText(formatSourceLine(entry, { guildId: interaction.guildId, channelNameById, threadNameById }), 1024), inline: false },
                    { name: 'Content Excerpt', value: embedSafeText(createKnowledgeExcerpt(entry.content, 900), 1024), inline: false }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (sub === 'unaccept') {
            const entryId = interaction.options.getString('entry_id', true);
            const reason = interaction.options.getString('reason') || '';
            const result = await unacceptKnowledgeSolution(interaction, config, { entryId, reason });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle('Knowledge Unaccepted')
                .setDescription(result.message)
                .setTimestamp();
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (sub === 'list') {
            const filter = interaction.options.getString('filter') || 'recent';
            const limit = interaction.options.getInteger('limit') || 10;
            const result = listKnowledgeEntriesForCuration(interaction, { filter, limit });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }
            const lines = result.entries.map(entry => {
                const id = formatKnowledgeId(entry.id);
                const marker = formatAcceptedMarker(Boolean(entry.is_accepted_solution));
                const preview = createKnowledgeExcerpt(entry.title || entry.content, 60);
                const source = formatSourceLine(entry, { guildId: interaction.guildId, channelNameById, threadNameById });
                return `${id} | ${marker} | ${preview}\n${source}\n${formatIsoTimestamp(entry.created_at)}`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`Knowledge List (${result.filter})`)
                .setDescription(embedSafeText(lines.join('\n\n') || result.message, 3500))
                .setFooter({ text: `Showing ${result.shown} of ${result.total} entries` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (sub === 'feedback') {
            const type = interaction.options.getString('type') || 'all';
            const limit = interaction.options.getInteger('limit') || 10;
            const status = interaction.options.getString('status') || 'open';
            const result = handleKnowledgeFeedbackList(interaction, { type, status, limit });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(result.title)
                .setDescription(embedSafeText((result.lines || []).join('\n\n') || result.message, 3500))
                .setFooter({ text: `Type: ${result.type} | Status: ${result.status} | Items: ${result.total}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (sub === 'review-feedback') {
            const askContextId = interaction.options.getString('ask_context_id', true);
            const type = interaction.options.getString('type', true);
            const status = interaction.options.getString('status', true);
            const note = interaction.options.getString('note') || '';
            const result = await handleKnowledgeFeedbackReview(interaction, { askContextId, type, status, note });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Feedback Review Updated')
                .setDescription(result.message)
                .setTimestamp();
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (sub === 'health') {
            const window = interaction.options.getString('window') || '7d';
            const result = handleKnowledgeHealth(interaction, { window });
            if (!result.ok) {
                await interaction.reply({ content: result.message, flags: 64 });
                return;
            }

            const topProblemLines = result.topProblems.length
                ? result.topProblems.map(item => {
                    const id = formatKnowledgeId(item.entryId);
                    const excerpt = createKnowledgeExcerpt(item.entry?.title || item.entry?.content || 'n/a', 55);
                    return `${id} | outdated=${item.outdatedCount} | not_helpful=${item.notHelpfulCount} | ${excerpt}`;
                }).join('\n')
                : 'Keine Problem-Entries im Zeitfenster.';

            const embed = new EmbedBuilder()
                .setTitle('Knowledge Health Dashboard')
                .addFields(
                    {
                        name: 'Summary',
                        value: embedSafeText([
                            `Ask responses: ${result.summary.askResponsesCount}`,
                            `Helpful: ${result.summary.helpfulCount}`,
                            `Not helpful: ${result.summary.notHelpfulCount}`,
                            `Outdated: ${result.summary.outdatedCount}`,
                            `Open feedback: ${result.summary.openFeedbackCount}`,
                            `Resolved feedback: ${result.summary.resolvedFeedbackCount}`
                        ].join('\n'), 1024),
                        inline: false
                    },
                    {
                        name: 'Quality Signals',
                        value: embedSafeText([
                            `Helpful ratio: ${result.quality.helpfulRatio}`,
                            `Outdated ratio: ${result.quality.outdatedRatio}`,
                            `Not helpful ratio: ${result.quality.notHelpfulRatio}`,
                            `Accepted solutions: ${result.quality.acceptedSolutionsCount}`,
                            `Low confidence answers: ${result.quality.lowConfidenceAnswerCount}`
                        ].join('\n'), 1024),
                        inline: false
                    },
                    {
                        name: 'Top Problem Entries',
                        value: embedSafeText(topProblemLines, 1024),
                        inline: false
                    },
                    {
                        name: 'Triage Status',
                        value: embedSafeText([
                            `open: ${result.triage.open || 0}`,
                            `reviewed: ${result.triage.reviewed || 0}`,
                            `resolved: ${result.triage.resolved || 0}`,
                            `ignored: ${result.triage.ignored || 0}`
                        ].join('\n'), 1024),
                        inline: false
                    },
                    {
                        name: 'Trends (Current vs Previous Window)',
                        value: embedSafeText([
                            `Helpful ratio: ${result.trends?.helpfulRatio || 'n/a'}`,
                            `Not helpful ratio: ${result.trends?.notHelpfulRatio || 'n/a'}`,
                            `Outdated ratio: ${result.trends?.outdatedRatio || 'n/a'}`,
                            `Ask responses: ${result.trends?.askResponsesCount || 'n/a'}`,
                            `Open feedback: ${result.trends?.openFeedbackCount || 'n/a'}`,
                            `Resolved feedback: ${result.trends?.resolvedFeedbackCount || 'n/a'}`,
                            result.trends?.note ? `Note: ${result.trends.note}` : null
                        ].filter(Boolean).join('\n'), 1024),
                        inline: false
                    }
                )
                .setFooter({ text: `Window: ${result.window} | Trends require minimum sample size | Use /knowledge feedback to review items` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        const result = { message: 'Unbekannter Knowledge-Subcommand.' };
        await interaction.reply({ content: result.message, flags: 64 });
    }
};


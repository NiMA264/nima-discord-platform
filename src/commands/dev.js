const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDevEmbedContent, embedSafe } = require('../utils/devFormatting');
const {
    handleDevExplain,
    handleDevReview,
    handleDevGenerateTests,
    handleDevDebugError,
    handleDevOptimize
} = require('../systems/devProductivitySystem');

const DEFAULT_STRUCTURED_INTRO = 'Structured analysis generated from the provided error context.';
const OPTIMIZE_STRUCTURED_INTRO = 'Optimization guidance generated from the provided code context.';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dev')
        .setDescription('Developer Productivity Commands')
        .addSubcommand(sub =>
            sub
                .setName('explain')
                .setDescription('Erklaert Code mit Risiken und Verbesserungen')
                .addStringOption(option => option.setName('code').setDescription('Code').setRequired(true))
                .addStringOption(option => option.setName('language').setDescription('Sprache').setRequired(false))
                .addStringOption(option => option.setName('goal').setDescription('Optionales Ziel').setRequired(false))
        )
        .addSubcommand(sub =>
            sub
                .setName('review')
                .setDescription('Fuehrt ein strukturiertes Code-Review aus')
                .addStringOption(option => option.setName('code').setDescription('Code').setRequired(true))
                .addStringOption(option => option.setName('language').setDescription('Sprache').setRequired(false))
                .addStringOption(option =>
                    option
                        .setName('focus')
                        .setDescription('Review Fokus')
                        .setRequired(false)
                        .addChoices(
                            { name: 'bugs', value: 'bugs' },
                            { name: 'security', value: 'security' },
                            { name: 'performance', value: 'performance' },
                            { name: 'readability', value: 'readability' },
                            { name: 'architecture', value: 'architecture' },
                            { name: 'all', value: 'all' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('generate-tests')
                .setDescription('Schlaegt Tests fuer Code vor')
                .addStringOption(option => option.setName('code').setDescription('Code').setRequired(true))
                .addStringOption(option => option.setName('language').setDescription('Sprache').setRequired(false))
                .addStringOption(option => option.setName('framework').setDescription('Testframework').setRequired(false))
        )
        .addSubcommand(sub =>
            sub
                .setName('debug-error')
                .setDescription('Analysiert Fehler/Stacktrace und liefert konkrete Debug-Schritte')
                .addStringOption(option => option.setName('error').setDescription('Fehlermeldung oder Stacktrace').setRequired(true))
                .addStringOption(option => option.setName('code').setDescription('Optionaler Codeausschnitt').setRequired(false))
                .addStringOption(option => option.setName('language').setDescription('Sprache').setRequired(false))
                .addStringOption(option => option.setName('context').setDescription('Optionaler Kontext').setRequired(false))
        )
        .addSubcommand(sub =>
            sub
                .setName('optimize')
                .setDescription('Analysiert Code auf Optimierungspotenzial')
                .addStringOption(option => option.setName('code').setDescription('Code').setRequired(true))
                .addStringOption(option => option.setName('language').setDescription('Sprache').setRequired(false))
                .addStringOption(option =>
                    option
                        .setName('goal')
                        .setDescription('Optimierungsziel')
                        .setRequired(false)
                        .addChoices(
                            { name: 'performance', value: 'performance' },
                            { name: 'readability', value: 'readability' },
                            { name: 'architecture', value: 'architecture' },
                            { name: 'maintainability', value: 'maintainability' },
                            { name: 'all', value: 'all' }
                        )
                )
        ),
    async execute(interaction, config) {
        const sub = interaction.options.getSubcommand();
        const code = interaction.options.getString('code') || '';
        const language = interaction.options.getString('language') || '';
        const goal = interaction.options.getString('goal') || '';
        const focus = interaction.options.getString('focus') || 'all';
        const framework = interaction.options.getString('framework') || '';
        const error = interaction.options.getString('error') || '';
        const context = interaction.options.getString('context') || '';
        const optimizeGoal = interaction.options.getString('goal') || 'all';

        await interaction.deferReply({ flags: 64 });

        let result;
        if (sub === 'explain') {
            if (!code) {
                await interaction.editReply({ content: 'Bitte Code angeben.' });
                return;
            }
            result = await handleDevExplain(config, { code, language, goal });
        } else if (sub === 'review') {
            if (!code) {
                await interaction.editReply({ content: 'Bitte Code angeben.' });
                return;
            }
            result = await handleDevReview(config, { code, language, focus });
        } else if (sub === 'generate-tests') {
            if (!code) {
                await interaction.editReply({ content: 'Bitte Code angeben.' });
                return;
            }
            result = await handleDevGenerateTests(config, { code, language, framework });
        } else if (sub === 'debug-error') {
            result = await handleDevDebugError(config, { error, code, language, context });
        } else if (sub === 'optimize') {
            if (!code) {
                await interaction.editReply({ content: 'Bitte Code angeben.' });
                return;
            }
            result = await handleDevOptimize(config, { code, language, goal: optimizeGoal });
        } else {
            await interaction.editReply({ content: 'Unbekannter /dev Subcommand.' });
            return;
        }

        if (!result.ok) {
            await interaction.editReply({ content: result.message || 'Command konnte nicht ausgefuehrt werden.' });
            return;
        }

        const content = formatDevEmbedContent(result.text);
        const description = sub === 'optimize' && content.description === DEFAULT_STRUCTURED_INTRO
            ? OPTIMIZE_STRUCTURED_INTRO
            : content.description;

        const embed = new EmbedBuilder()
            .setTitle(result.title)
            .setDescription(description)
            .setFooter({ text: 'No execution performed | AI-generated guidance' })
            .setTimestamp();

        if (sub === 'review') {
            embed.addFields({ name: 'Focus', value: embedSafe(focus, 50), inline: true });
        }
        if (sub === 'generate-tests' && framework) {
            embed.addFields({ name: 'Framework', value: embedSafe(framework, 80), inline: true });
        }
        if (sub === 'debug-error' && language) {
            embed.addFields({ name: 'Language', value: embedSafe(language, 80), inline: true });
        }
        if (sub === 'optimize') {
            embed.addFields({ name: 'Goal', value: embedSafe(optimizeGoal, 80), inline: true });
            if (language) {
                embed.addFields({ name: 'Language', value: embedSafe(language, 80), inline: true });
            }
        }
        if (content.fields.length) {
            embed.addFields(...content.fields.slice(0, 5));
        }

        await interaction.editReply({ embeds: [embed] });
    }
};

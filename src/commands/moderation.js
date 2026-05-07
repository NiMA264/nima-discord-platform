const { SlashCommandBuilder } = require('discord.js');
const { hasModerationPermission } = require('../utils/permissions');
const { warnMember, timeoutMember, kickMember, banMember } = require('../systems/moderationSystem');

const MAX_TIMEOUT_MINUTES = 40320;

function clampTimeoutMinutes(value) {
    if (!Number.isFinite(value)) return 10;
    return Math.max(1, Math.min(MAX_TIMEOUT_MINUTES, Math.trunc(value)));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Moderation actions for staff')
        .addSubcommand(sub =>
            sub
                .setName('warn')
                .setDescription('Warn a member')
                .addUserOption(option =>
                    option.setName('user').setDescription('Target member').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason').setDescription('Reason for warning').setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('timeout')
                .setDescription('Timeout a member')
                .addUserOption(option =>
                    option.setName('user').setDescription('Target member').setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('minutes')
                        .setDescription('Duration in minutes (1-40320)')
                        .setMinValue(1)
                        .setMaxValue(MAX_TIMEOUT_MINUTES)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason').setDescription('Reason for timeout').setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('kick')
                .setDescription('Kick a member')
                .addUserOption(option =>
                    option.setName('user').setDescription('Target member').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason').setDescription('Reason for kick').setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('ban')
                .setDescription('Ban a user')
                .addUserOption(option =>
                    option.setName('user').setDescription('Target user').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason').setDescription('Reason for ban').setRequired(false)
                )
        ),
    async execute(interaction, config) {
        if (!hasModerationPermission(interaction.member)) {
            await interaction.reply({ content: 'Nur Moderatoren dürfen diesen Command ausführen.', flags: 64 });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const targetUser = interaction.options.getUser('user', true);
        const targetMember = interaction.guild.members.cache.get(targetUser.id) || null;

        if (subcommand === 'warn') {
            if (!targetMember) {
                await interaction.reply({ content: 'User ist nicht auf diesem Server.', flags: 64 });
                return;
            }

            await warnMember(interaction, config, targetMember, reason);
            await interaction.reply({ content: `Warnung gespeichert für ${targetUser.tag}.`, flags: 64 });
            return;
        }

        if (subcommand === 'timeout') {
            if (!targetMember) {
                await interaction.reply({ content: 'User ist nicht auf diesem Server.', flags: 64 });
                return;
            }

            const minutes = clampTimeoutMinutes(interaction.options.getInteger('minutes', true));
            const durationMs = minutes * 60 * 1000;
            await timeoutMember(interaction, config, targetMember, durationMs, reason);
            await interaction.reply({ content: `${targetUser.tag} wurde für ${minutes} Minuten getimeoutet.`, flags: 64 });
            return;
        }

        if (subcommand === 'kick') {
            if (!targetMember) {
                await interaction.reply({ content: 'User ist nicht auf diesem Server.', flags: 64 });
                return;
            }

            await kickMember(interaction, config, targetMember, reason);
            await interaction.reply({ content: `${targetUser.tag} wurde gekickt.`, flags: 64 });
            return;
        }

        if (subcommand === 'ban') {
            await banMember(interaction, config, targetUser, reason, 0);
            await interaction.reply({ content: `${targetUser.tag} wurde gebannt.`, flags: 64 });
        }
    }
};

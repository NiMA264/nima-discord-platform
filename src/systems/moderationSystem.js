const { logModerationEvent } = require('./logSystem');
const { createWarning } = require('../repositories/moderationRepository');
const { moderationInfo } = require('../utils/logger');

async function timeoutMember(interaction, config, targetMember, durationMs, reason = 'No reason provided') {
    await targetMember.timeout(durationMs, reason);
    await logModerationEvent(interaction.guild, config, `timeout | target=${targetMember.user.tag} | by=${interaction.user.tag} | durationMs=${durationMs} | reason=${reason}`);
}

async function warnMember(interaction, config, targetMember, reason = 'No reason provided') {
    createWarning({
        guildId: interaction.guild.id,
        userId: targetMember.id,
        moderatorId: interaction.user.id,
        reason,
        createdAt: new Date().toISOString()
    });

    moderationInfo('Warning persisted', {
        guildId: interaction.guild.id,
        userId: targetMember.id,
        moderatorId: interaction.user.id
    });

    await logModerationEvent(interaction.guild, config, `warn | target=${targetMember.user.tag} | by=${interaction.user.tag} | reason=${reason}`);
}

async function kickMember(interaction, config, targetMember, reason = 'No reason provided') {
    await targetMember.kick(reason);
    await logModerationEvent(interaction.guild, config, `kick | target=${targetMember.user.tag} | by=${interaction.user.tag} | reason=${reason}`);
}

async function banMember(interaction, config, targetUser, reason = 'No reason provided', deleteMessageSeconds = 0) {
    await interaction.guild.members.ban(targetUser.id, { reason, deleteMessageSeconds });
    await logModerationEvent(interaction.guild, config, `ban | target=${targetUser.tag} | by=${interaction.user.tag} | reason=${reason}`);
}

module.exports = {
    timeoutMember,
    warnMember,
    kickMember,
    banMember
};

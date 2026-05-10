const { hasManageGuildPermission } = require('../utils/permissions');

const EPHEMERAL_FLAG = 64;

function supportGateConfig(env = process.env) {
    const supportGuildId = String(env.SUPPORT_GUILD_ID || '').trim();
    const supportInviteUrl = String(env.SUPPORT_INVITE_URL || '').trim();
    return {
        enabled: supportGuildId.length > 0,
        supportGuildId,
        supportInviteUrl
    };
}

async function isMemberOfSupportGuild(interaction, supportGuildId) {
    const guild = await interaction.client.guilds.fetch(supportGuildId);
    await guild.members.fetch(interaction.user.id);
    return true;
}

async function requireSupportGuildMembership(interaction, options = {}) {
    const cfg = supportGateConfig(options.env || process.env);
    if (!cfg.enabled) return { ok: true, skipped: true, reason: 'gate_disabled' };

    const allowAdminBypass = options.allowAdminBypass !== false;
    if (allowAdminBypass && hasManageGuildPermission(interaction.member)) {
        return { ok: true, skipped: true, reason: 'admin_bypass' };
    }

    try {
        await isMemberOfSupportGuild(interaction, cfg.supportGuildId);
        return { ok: true, skipped: false };
    } catch (_err) {
        const inviteSuffix = cfg.supportInviteUrl ? ` ${cfg.supportInviteUrl}` : '';
        await interaction.reply({
            content: `Bitte tritt zuerst unserem Support-Discord bei:${inviteSuffix}`.trim(),
            flags: EPHEMERAL_FLAG
        });
        return { ok: false, skipped: false, reason: 'not_member' };
    }
}

module.exports = {
    supportGateConfig,
    requireSupportGuildMembership
};


const { PermissionFlagsBits } = require('discord.js');

function hasPermissions(member, requiredPermissions = []) {
    if (!member || !member.permissions) return false;
    return requiredPermissions.every(permission => member.permissions.has(permission));
}

function hasAnyPermission(member, permissions = []) {
    if (!member || !member.permissions) return false;
    return permissions.some(permission => member.permissions.has(permission));
}

function hasManageGuildPermission(member) {
    return hasAnyPermission(member, [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild]);
}

function hasTicketStaffPermission(member) {
    return hasAnyPermission(member, [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ModerateMembers
    ]);
}

function hasModerationPermission(member) {
    return hasAnyPermission(member, [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers
    ]);
}

module.exports = {
    hasPermissions,
    hasAnyPermission,
    hasManageGuildPermission,
    hasTicketStaffPermission,
    hasModerationPermission
};

const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    adminOnly: [PermissionFlagsBits.Administrator],
    manageGuild: [PermissionFlagsBits.ManageGuild],
    ticketStaff: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages]
};

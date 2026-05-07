const theme = require('../config/theme');
const { EmbedBuilder } = require('discord.js');

function createEmbed(title, description, color = theme.primaryColor) {
    return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
}

module.exports = { createEmbed };

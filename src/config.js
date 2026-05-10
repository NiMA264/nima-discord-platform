const theme = require('./config/theme');
const roles = require('./config/roles');
const channels = require('./config/channels');
const permissions = require('./config/permissions');
const ai = require('./config/ai');
const systemPrompt = require('./config/systemPrompt');

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    supportGuildId: process.env.SUPPORT_GUILD_ID || '',
    supportInviteUrl: process.env.SUPPORT_INVITE_URL || '',
    theme,
    roles,
    channels,
    permissions,
    ai,
    systemPrompt
};

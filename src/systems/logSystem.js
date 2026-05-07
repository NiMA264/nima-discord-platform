const { createEmbed } = require('../utils/embed');
const { findTextChannel } = require('../utils/resolvers');

function buildLogMessage(scope, message) {
    const ts = new Date().toISOString();
    return `[${ts}] [${scope}] ${message}`;
}

async function logToChannel(guild, channelName, scope, message) {
    try {
        const channel = findTextChannel(guild, channelName);
        if (!channel) {
            return false;
        }

        await channel.send({ content: buildLogMessage(scope, message) });
        return true;
    } catch (err) {
        const fallback = findTextChannel(guild, guild.systemChannel?.name || '');
        if (fallback) {
            await fallback.send({ embeds: [createEmbed('Log Error', `Log failed in scope ${scope}: ${err.message}`)] });
        }
        return false;
    }
}

async function logTicketEvent(guild, config, message) {
    return logToChannel(guild, config.channels.channels.ticketLogs, 'TICKET', message);
}

async function logJoinLeaveEvent(guild, config, message) {
    return logToChannel(guild, config.channels.channels.joinLeave, 'MEMBER', message);
}

async function logModerationEvent(guild, config, message) {
    return logToChannel(guild, config.channels.channels.modLogs, 'MOD', message);
}

module.exports = { logTicketEvent, logJoinLeaveEvent, logModerationEvent, logToChannel, buildLogMessage };

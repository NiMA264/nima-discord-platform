const { DiscordAPIError } = require('discord.js');
const { logger } = require('../lib/logger');

function scoped(scope) {
    const scopedLogger = logger.child({ scope });
    return {
        info(message, context) {
            scopedLogger.info(message, context);
        },
        warn(message, context) {
            scopedLogger.warn(message, context);
        },
        error(message, context) {
            scopedLogger.error(message, context);
        }
    };
}

function info(message, context) {
    logger.info(message, context);
}

function warn(message, context) {
    logger.warn(message, context);
}

function error(message, context) {
    logger.error(message, context);
}

function formatError(err) {
    if (!err) return 'Unknown error';
    if (err instanceof DiscordAPIError) {
        return `DiscordAPIError(${err.code}): ${err.message}`;
    }

    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }

    return String(err);
}

const dbLogger = scoped('DATABASE');
const aiLogger = scoped('AI');
const ticketLogger = scoped('TICKET');
const moderationLogger = scoped('MODERATION');

module.exports = {
    info,
    warn,
    error,
    formatError,
    scoped,
    dbInfo: dbLogger.info,
    dbWarn: dbLogger.warn,
    dbError: dbLogger.error,
    aiInfo: aiLogger.info,
    aiWarn: aiLogger.warn,
    aiError: aiLogger.error,
    ticketInfo: ticketLogger.info,
    ticketWarn: ticketLogger.warn,
    ticketError: ticketLogger.error,
    moderationInfo: moderationLogger.info,
    moderationWarn: moderationLogger.warn,
    moderationError: moderationLogger.error
};

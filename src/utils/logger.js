const { DiscordAPIError } = require('discord.js');

function formatContext(context = {}) {
    const parts = Object.entries(context)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${String(value)}`);

    return parts.length ? ` | ${parts.join(' ')}` : '';
}

function log(level, message, context) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}${formatContext(context)}`;

    if (level === 'ERROR') {
        console.error(line);
        return;
    }

    if (level === 'WARN') {
        console.warn(line);
        return;
    }

    console.log(line);
}

function scoped(scope) {
    return {
        info(message, context) {
            log('INFO', `[${scope}] ${message}`, context);
        },
        warn(message, context) {
            log('WARN', `[${scope}] ${message}`, context);
        },
        error(message, context) {
            log('ERROR', `[${scope}] ${message}`, context);
        }
    };
}

function info(message, context) {
    log('INFO', message, context);
}

function warn(message, context) {
    log('WARN', message, context);
}

function error(message, context) {
    log('ERROR', message, context);
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

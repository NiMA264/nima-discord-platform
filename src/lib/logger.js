function serializeContext(context = {}) {
    return Object.fromEntries(
        Object.entries(context).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
}

function writeLog(level, message, context = {}) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...serializeContext(context)
    };

    const line = JSON.stringify(payload);
    if (level === 'error') {
        process.stderr.write(`${line}\n`);
        return;
    }

    process.stdout.write(`${line}\n`);
}

function createLogger(baseContext = {}) {
    function log(level, message, context = {}) {
        writeLog(level, message, { ...baseContext, ...context });
    }

    return {
        child(context = {}) {
            return createLogger({ ...baseContext, ...context });
        },
        info(message, context) {
            log('info', message, context);
        },
        warn(message, context) {
            log('warn', message, context);
        },
        error(message, context) {
            log('error', message, context);
        }
    };
}

const logger = createLogger();

module.exports = {
    createLogger,
    logger
};

const { handleCodingMessage } = require('../systems/aiSystem');
const { error: logError, formatError } = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    async execute(message, config) {
        try {
            await handleCodingMessage(message, config);
        } catch (err) {
            logError('messageCreate failed', { error: formatError(err), channelId: message.channelId });
        }
    }
};

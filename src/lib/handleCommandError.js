const { normalizeError } = require('./errors');
const { scoped } = require('../utils/logger');
const { safeInteractionError } = require('../utils/discord');

const commandErrorLog = scoped('COMMAND_ERROR');

async function handleCommandError(interaction, err, fallbackMessage) {
    const normalized = normalizeError(err);

    commandErrorLog.error('Command execution failed', {
        command: interaction.commandName,
        userId: interaction.user?.id,
        guildId: interaction.guildId,
        errorName: normalized.name,
        errorMessage: normalized.message
    });

    await safeInteractionError(
        interaction,
        err,
        fallbackMessage || `Fehler beim Ausführen von /${interaction.commandName}.`
    );
}

module.exports = {
    handleCommandError
};

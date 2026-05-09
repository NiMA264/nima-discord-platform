const setupCommand = require('../commands/setup');
const moderationCommand = require('../commands/moderation');
const askCommand = require('../commands/ask');
const threadSummaryCommand = require('../commands/threadSummary');
const knowledgeCommand = require('../commands/knowledge');
const devCommand = require('../commands/dev');
const projectCommand = require('../commands/project');
const taskCommand = require('../commands/task');
const sprintCommand = require('../commands/sprint');
const aiCommand = require('../commands/ai');
const { handleCommandError } = require('../lib/handleCommandError');

const commandMap = {
    setup: setupCommand,
    moderation: moderationCommand,
    ask: askCommand,
    'thread-summary': threadSummaryCommand,
    knowledge: knowledgeCommand,
    dev: devCommand,
    project: projectCommand,
    task: taskCommand,
    sprint: sprintCommand,
    ai: aiCommand
};

async function handleChatInputCommand(interaction, config) {
    const handler = commandMap[interaction.commandName];
    if (!handler) return false;

    try {
        await handler.execute(interaction, config);
        return true;
    } catch (err) {
        await handleCommandError(interaction, err, `Fehler beim Ausführen von /${interaction.commandName}.`);
        return true;
    }
}

module.exports = {
    handleChatInputCommand,
    commandMap
};

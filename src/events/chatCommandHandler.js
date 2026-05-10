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
const helpCommand = require('../commands/help');
const { handleCommandError } = require('../lib/handleCommandError');
const metrics = require('../lib/metrics');
const { requireSupportGuildMembership } = require('../guards/requireSupportGuildMembership');

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
    ai: aiCommand,
    help: helpCommand
};

async function handleChatInputCommand(interaction, config) {
    const handler = commandMap[interaction.commandName];
    if (!handler) return false;

    const supportGate = await requireSupportGuildMembership(interaction);
    if (!supportGate.ok) return true;

    const timer = metrics.startTimer('command_execution', { command: interaction.commandName });
    try {
        await handler.execute(interaction, config);
        metrics.increment('command_success_total', 1, { command: interaction.commandName });
        timer.stop({ status: 'success' });
        return true;
    } catch (err) {
        metrics.increment('command_failure_total', 1, { command: interaction.commandName });
        timer.stop({ status: 'failure' });
        await handleCommandError(interaction, err, `Fehler beim Ausführen von /${interaction.commandName}.`);
        return true;
    }
}

module.exports = {
    handleChatInputCommand,
    commandMap
};

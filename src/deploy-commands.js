require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { validateEnv } = require('./utils/envValidator');
const { scoped } = require('./utils/logger');
const setupCommand = require('./commands/setup');
const moderationCommand = require('./commands/moderation');
const askCommand = require('./commands/ask');
const threadSummaryCommand = require('./commands/threadSummary');
const knowledgeCommand = require('./commands/knowledge');
const devCommand = require('./commands/dev');
const projectCommand = require('./commands/project');
const taskCommand = require('./commands/task');
const sprintCommand = require('./commands/sprint');
const aiCommand = require('./commands/ai');

const deployLog = scoped('DEPLOY');

function validateDeployEnv() {
    const result = validateEnv(process.env);
    if (!result.ok) {
        process.exit(1);
    }
}

async function deploy() {
    validateDeployEnv();

    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    const commands = [
        setupCommand.data.toJSON(),
        moderationCommand.data.toJSON(),
        askCommand.data.toJSON(),
        threadSummaryCommand.data.toJSON(),
        knowledgeCommand.data.toJSON(),
        devCommand.data.toJSON(),
        projectCommand.data.toJSON(),
        taskCommand.data.toJSON(),
        sprintCommand.data.toJSON(),
        aiCommand.data.toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(token);

    deployLog.info('Starting command deployment');
    deployLog.info('Deploy target', { guildId });

    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );

    deployLog.info('Command deployment finished successfully');
}

deploy().catch(err => {
    deployLog.error('Deployment failed', { error: err?.message || String(err) });
    process.exit(1);
});

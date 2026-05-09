require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { validateEnv } = require('./utils/envValidator');
const setupCommand = require('./commands/setup');
const moderationCommand = require('./commands/moderation');
const askCommand = require('./commands/ask');
const threadSummaryCommand = require('./commands/threadSummary');
const knowledgeCommand = require('./commands/knowledge');
const devCommand = require('./commands/dev');
const projectCommand = require('./commands/project');
const taskCommand = require('./commands/task');
const sprintCommand = require('./commands/sprint');

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
        sprintCommand.data.toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(token);

    console.log('[DEPLOY] Starting command deployment...');
    console.log(`[DEPLOY] Guild: ${guildId}`);
    console.log('[DEPLOY] Replacing existing guild commands with: /setup, /moderation, /ask, /thread-summary, /knowledge, /dev, /project, /task, /sprint');

    await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
    );

    console.log('[DEPLOY] Command deployment finished successfully.');
}

deploy().catch(err => {
    console.error('[DEPLOY ERROR]', err.message);
    process.exit(1);
});

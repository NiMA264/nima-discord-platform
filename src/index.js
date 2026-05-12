require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { initializeDatabase } = require('./database/database');
const { ensurePhase1Persistence } = require('./database/phase1PersistenceMigration');
const { assertEnvironment } = require('./config/env');
const { info, error: logError, formatError, dbInfo } = require('./utils/logger');
const { startGithubWebhookServer } = require('./integrations/github/githubWebhookServer');
const { startGithubEventWorker } = require('./workers/githubEventWorker');
const { startScheduledDigestWorker } = require('./workers/digestWorker');
const { startInactivityDetectionWorker } = require('./workers/inactivityDetectionWorker');
const { startWorkflowDigestWorker } = require('./workers/workflowDigestWorker');
const { startPublicApiServer } = require('./api/v1/server');
const { registerNotificationAdapter } = require('./services/notificationService');
const {
    createDiscordNotificationAdapter,
    setDiscordNotificationClient
} = require('./integrations/notifications/discordNotificationDeliveryAdapter');
const { setDiscordDigestDeliveryClient } = require('./services/discordDigestDeliveryService');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

function registerGlobalErrorHandlers() {
    process.on('unhandledRejection', reason => {
        logError('Unhandled promise rejection', { error: formatError(reason) });
    });

    process.on('uncaughtException', err => {
        logError('Uncaught exception', { error: formatError(err) });
    });

    client.on('error', err => {
        logError('Discord client error', { error: formatError(err) });
    });

    client.rest.on('rateLimited', data => {
        info('Discord rate limit', {
            global: data.global,
            timeout: data.timeToReset,
            route: data.route
        });
    });
}

function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        const executeEvent = async (...args) => {
            try {
                await event.execute(...args, config);
            } catch (err) {
                logError('Event execution failed', { event: event.name, file, error: formatError(err) });
            }
        };

        if (event.once) {
            client.once(event.name, executeEvent);
        } else {
            client.on(event.name, executeEvent);
        }
    }
}

function validateStartupEnv() {
    assertEnvironment(process.env);
}

function initializePersistenceLayer() {
    initializeDatabase();
    ensurePhase1Persistence();
    dbInfo('Persistence layer ready');
    startGithubEventWorker();
    startGithubWebhookServer();
}

function initializeNotificationLayer() {
    setDiscordNotificationClient(client);
    setDiscordDigestDeliveryClient(client);
    registerNotificationAdapter(createDiscordNotificationAdapter());
    info('Notification layer ready');
}

function initializeAutomationLayer() {
    startScheduledDigestWorker(client);
    startInactivityDetectionWorker(client);
    startWorkflowDigestWorker(client);
    info('Automation layer ready');
}

function initializePublicApiLayer() {
    startPublicApiServer();
    info('Public API layer ready');
}

async function bootstrap() {
    registerGlobalErrorHandlers();
    validateStartupEnv();
    initializePersistenceLayer();
    initializeNotificationLayer();
    initializeAutomationLayer();
    initializePublicApiLayer();

    info('Starting NiMa Discord bot', {
        guildId: config.guildId,
        clientId: config.clientId
    });

    loadEvents();
    await client.login(config.token);
}

bootstrap().catch(err => {
    logError('Bot bootstrap failed', { error: formatError(err) });
    process.exit(1);
});

const { AiService } = require('./aiService');
const systemPrompt = require('../config/systemPrompt');
const { splitDiscordMessage, truncateText } = require('../utils/message');
const { aiWarn, aiError, formatError } = require('../utils/logger');

let aiService;

function getAiService(config) {
    if (!aiService) {
        aiService = new AiService({
            enabled: config.ai.enabled,
            apiKey: process.env.OPENAI_API_KEY,
            model: config.ai.model,
            systemPrompt,
            maxContextMessages: config.ai.maxContextMessages,
            memoryRetentionDays: config.ai.memoryRetentionDays,
            rateLimitWindowMs: config.ai.rateLimitWindowMs,
            rateLimitPerUser: config.ai.rateLimitPerUser
        });
    }

    return aiService;
}

async function sendSplitReply(message, text) {
    const safeText = truncateText(text, 1900 * 8);
    const parts = splitDiscordMessage(safeText, 1900);

    if (!parts.length) {
        await message.reply('Ich habe aktuell keine verwertbare Antwort erzeugt. Bitte formuliere die Frage konkreter.');
        return;
    }

    await message.reply(parts[0]);
    for (let i = 1; i < parts.length; i += 1) {
        await message.channel.send(parts[i]);
    }
}

async function handleCodingMessage(message, config) {
    if (!config.ai.enabled || message.author.bot) return;
    if (!config.ai.triggerChannels.includes(message.channel.name)) return;

    if (!message.mentions.has(message.client.user) && !message.content.toLowerCase().includes('help')) {
        return;
    }

    const service = getAiService(config);
    if (service.isRateLimited(message.author.id)) {
        await message.reply('Rate Limit erreicht. Bitte warte kurz und versuche es erneut.');
        return;
    }

    try {
        const answer = await service.answerCodingMessage(message, config.ai.fallbackResponse);
        await sendSplitReply(message, answer);
    } catch (err) {
        aiError('AI system failed and fallback was sent', { error: formatError(err), channelId: message.channelId });
        aiWarn('Fallback AI response used', { userId: message.author.id });
        await sendSplitReply(message, config.ai.fallbackResponse);
    }
}

module.exports = { handleCodingMessage };

const { OpenAI } = require('openai');
const { createMemoryEntry, getRecentMemory, cleanupMemoryBefore } = require('../repositories/aiMemoryRepository');
const { truncateText } = require('../utils/message');
const { aiInfo, aiWarn, aiError, formatError } = require('../utils/logger');

const MAX_MEMORY_CONTENT_LENGTH = 4000;
const MAX_INPUT_LENGTH = 3500;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

class AiService {
    constructor(options = {}) {
        this.enabled = Boolean(options.enabled);
        this.model = options.model || 'gpt-4.1-mini';
        this.systemPrompt = options.systemPrompt || '';
        this.maxContextMessages = options.maxContextMessages || 12;
        this.memoryRetentionDays = options.memoryRetentionDays || 14;
        this.rateLimit = {
            windowMs: options.rateLimitWindowMs || 60000,
            maxRequestsPerUser: options.rateLimitPerUser || 8
        };
        this.userBuckets = new Map();
        this.lastCleanupAt = 0;

        if (this.enabled && options.apiKey) {
            this.client = new OpenAI({ apiKey: options.apiKey });
            aiInfo('OpenAI client enabled', { model: this.model });
        } else {
            this.client = null;
            aiWarn('OpenAI client disabled, fallback mode active');
        }
    }

    isRateLimited(userId) {
        const now = Date.now();
        const bucket = this.userBuckets.get(userId) || [];
        const valid = bucket.filter(ts => now - ts < this.rateLimit.windowMs);

        if (valid.length >= this.rateLimit.maxRequestsPerUser) {
            this.userBuckets.set(userId, valid);
            return true;
        }

        valid.push(now);
        this.userBuckets.set(userId, valid);
        return false;
    }

    maybeCleanupOldMemory() {
        const now = Date.now();
        if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
            return;
        }

        const cutoff = new Date(now - this.memoryRetentionDays * 24 * 60 * 60 * 1000).toISOString();
        const result = cleanupMemoryBefore(cutoff);
        this.lastCleanupAt = now;
        aiInfo('AI memory cleanup completed', { deletedRows: result.changes, cutoff });
    }

    buildContext(guildId, channelId, userInput) {
        const rows = getRecentMemory(guildId, channelId, this.maxContextMessages);
        const conversation = rows.map(row => ({ role: row.role, content: row.content }));
        conversation.push({ role: 'user', content: userInput });
        return conversation;
    }

    storeMemoryEntry(data) {
        const content = truncateText(data.content, MAX_MEMORY_CONTENT_LENGTH);
        if (!content) return;

        createMemoryEntry({
            guildId: data.guildId,
            channelId: data.channelId,
            userId: data.userId,
            role: data.role,
            content,
            createdAt: new Date().toISOString()
        });
    }

    async answerCodingMessage(message, fallbackResponse) {
        const guildId = message.guildId || 'dm';
        const channelId = message.channelId;
        const userId = message.author.id;
        const userInput = truncateText(message.content, MAX_INPUT_LENGTH);

        if (!userInput) {
            return fallbackResponse;
        }

        const contextMessages = this.buildContext(guildId, channelId, userInput);
        this.storeMemoryEntry({ guildId, channelId, userId, role: 'user', content: userInput });

        if (!this.enabled || !this.client) {
            return fallbackResponse;
        }

        try {
            const response = await this.client.responses.create({
                model: this.model,
                input: [
                    { role: 'system', content: this.systemPrompt },
                    ...contextMessages
                ]
            });

            const answer = truncateText((response.output_text || fallbackResponse).trim(), 1900 * 8);
            if (!answer) {
                return fallbackResponse;
            }

            this.storeMemoryEntry({
                guildId,
                channelId,
                userId: message.client.user.id,
                role: 'assistant',
                content: answer
            });

            this.maybeCleanupOldMemory();
            return answer;
        } catch (err) {
            aiError('AI response generation failed', {
                guildId,
                channelId,
                userId,
                error: formatError(err)
            });
            return fallbackResponse;
        }
    }
}

module.exports = { AiService };

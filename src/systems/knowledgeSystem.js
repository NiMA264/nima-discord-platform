const { OpenAI } = require('openai');
const {
    createKnowledgeEntry,
    createKnowledgeEvent,
    searchKnowledgeEntries,
    getThreadKnowledgeEntries
} = require('../repositories/knowledgeRepository');
const { truncateText } = require('../utils/message');
const { aiWarn, aiError, formatError } = require('../utils/logger');

const MIN_CONTENT_LENGTH = 40;
const MAX_INGEST_CONTENT = 3000;
const DEFAULT_SEARCH_LIMIT = 5;

function buildRelevantChannelSet(config) {
    const c = config.channels?.channels || {};
    const configured = config.ai?.triggerChannels || [];
    return new Set([
        ...configured,
        c.codingGeneral,
        c.javascript,
        c.python,
        c.frontend,
        c.backend,
        c.discordBots,
        c.projectLogs
    ].filter(Boolean));
}

function getThreadIdFromMessage(message) {
    if (!message?.channel) return null;
    if (typeof message.channel.isThread === 'function' && message.channel.isThread()) {
        return message.channel.id;
    }
    return message.channel.parentId || null;
}

function shouldIngestMessage(message, config) {
    if (!message?.guildId) return { ok: false, reason: 'not-in-guild' };
    if (!message?.author || message.author.bot) return { ok: false, reason: 'bot-message' };
    if (!message?.content || message.content.trim().length < MIN_CONTENT_LENGTH) return { ok: false, reason: 'low-value-content' };
    if (message.content.trim().startsWith('/')) return { ok: false, reason: 'slash-command-like' };

    const relevantChannels = buildRelevantChannelSet(config);
    if (!relevantChannels.has(message.channel?.name)) return { ok: false, reason: 'irrelevant-channel' };

    return { ok: true, reason: 'accepted' };
}

function buildThreadSummaryFallback(entries) {
    const points = entries.slice(-8).map(entry => `- ${truncateText(entry.content.replace(/\s+/g, ' ').trim(), 180)}`);
    if (!points.length) {
        return 'Keine ausreichenden Inhalte im Thread gefunden.';
    }
    return ['Kurzzusammenfassung (Fallback):', ...points].join('\n');
}

function getAiClient(config) {
    const enabled = Boolean(config?.ai?.enabled);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!enabled || !apiKey) return null;
    return new OpenAI({ apiKey });
}

async function ingestKnowledgeFromMessage(message, config) {
    const decision = shouldIngestMessage(message, config);
    const threadId = getThreadIdFromMessage(message);

    createKnowledgeEvent({
        guildId: message.guildId || 'dm',
        channelId: message.channelId,
        threadId,
        messageId: message.id,
        eventType: decision.ok ? 'ingest.accepted' : 'ingest.skipped',
        details: decision.reason,
        createdAt: new Date().toISOString()
    });

    if (!decision.ok) return { stored: false, reason: decision.reason };

    const cleanContent = truncateText(message.content.trim(), MAX_INGEST_CONTENT);
    createKnowledgeEntry({
        guildId: message.guildId,
        channelId: message.channelId,
        threadId,
        sourceMessageId: message.id,
        sourceType: 'message',
        title: truncateText(cleanContent.split('\n')[0], 120) || 'Thread message',
        content: cleanContent,
        tags: message.channel?.name || '',
        createdBy: message.author.id,
        createdAt: new Date().toISOString()
    });

    return { stored: true, reason: 'accepted' };
}

async function generateThreadSummary(config, entries) {
    const aiClient = getAiClient(config);
    if (!aiClient) return buildThreadSummaryFallback(entries);

    const model = config.ai?.model || 'gpt-4.1-mini';
    const transcript = entries.map(item => `- ${item.content}`).join('\n');

    try {
        const response = await aiClient.responses.create({
            model,
            input: [
                {
                    role: 'system',
                    content: 'Fasse technischen Thread-Content knapp und praxisnah zusammen. Nutze Bulletpoints.'
                },
                {
                    role: 'user',
                    content: `Fasse diesen Thread zusammen:\n${truncateText(transcript, 12000)}`
                }
            ]
        });

        return truncateText((response.output_text || '').trim(), 1900) || buildThreadSummaryFallback(entries);
    } catch (err) {
        aiWarn('thread summary fallback used', { error: formatError(err) });
        return buildThreadSummaryFallback(entries);
    }
}

async function summarizeCurrentThread(interaction, config) {
    const guildId = interaction.guildId;
    const threadId = interaction.channel?.id;
    if (!guildId || !threadId || !(typeof interaction.channel?.isThread === 'function' && interaction.channel.isThread())) {
        return { ok: false, reason: 'Dieser Command funktioniert nur in Threads.' };
    }

    const entries = getThreadKnowledgeEntries(guildId, threadId, 60);
    if (!entries.length) {
        return { ok: false, reason: 'Keine Knowledge-Daten in diesem Thread gefunden.' };
    }

    const summary = await generateThreadSummary(config, entries);
    createKnowledgeEntry({
        guildId,
        channelId: interaction.channelId,
        threadId,
        sourceMessageId: null,
        sourceType: 'thread_summary',
        title: `Summary: ${interaction.channel.name || threadId}`,
        content: summary,
        tags: `summary,${interaction.channel?.name || 'thread'}`,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString()
    });

    createKnowledgeEvent({
        guildId,
        channelId: interaction.channelId,
        threadId,
        messageId: null,
        eventType: 'summary.created',
        details: `entries=${entries.length}`,
        createdAt: new Date().toISOString()
    });

    return { ok: true, summary };
}

function buildAskFallbackAnswer(question, hits) {
    const top = hits.slice(0, 3).map((hit, index) => `${index + 1}. ${hit.title}: ${truncateText(hit.content, 180)}`).join('\n');
    return `Ich habe lokale Knowledge-Einträge gefunden, aber keine AI-Formulierung erzeugt.\nFrage: ${question}\n\nRelevante Treffer:\n${top}`;
}

function buildSourceHints(hits) {
    return hits.slice(0, 5).map((hit, index) => {
        const threadHint = hit.thread_id ? `thread=${hit.thread_id}` : 'thread=n/a';
        return `${index + 1}. channel=${hit.channel_id}, ${threadHint}, entry=${hit.id}`;
    }).join('\n');
}

async function askFromKnowledge(config, guildId, question, limit = DEFAULT_SEARCH_LIMIT) {
    const hits = searchKnowledgeEntries(guildId, question, limit);
    if (!hits.length) {
        return {
            ok: true,
            answer: 'Ich habe in der aktuellen Knowledge-Base noch keine passende Antwort gefunden.',
            sources: []
        };
    }

    const aiClient = getAiClient(config);
    if (!aiClient) {
        return { ok: true, answer: buildAskFallbackAnswer(question, hits), sources: hits };
    }

    const model = config.ai?.model || 'gpt-4.1-mini';
    const context = hits.map((hit, index) => `[${index + 1}] ${hit.title}\n${truncateText(hit.content, 800)}`).join('\n\n');

    try {
        const response = await aiClient.responses.create({
            model,
            input: [
                {
                    role: 'system',
                    content: 'Beantworte die Frage nur mit den bereitgestellten Knowledge-Snippets. Wenn etwas fehlt, sage es klar.'
                },
                {
                    role: 'user',
                    content: `Frage: ${question}\n\nKnowledge:\n${context}`
                }
            ]
        });

        const answer = truncateText((response.output_text || '').trim(), 1900) || buildAskFallbackAnswer(question, hits);
        return { ok: true, answer, sources: hits };
    } catch (err) {
        aiError('knowledge ask AI failed', { guildId, error: formatError(err) });
        return { ok: true, answer: buildAskFallbackAnswer(question, hits), sources: hits };
    }
}

module.exports = {
    MIN_CONTENT_LENGTH,
    shouldIngestMessage,
    ingestKnowledgeFromMessage,
    summarizeCurrentThread,
    askFromKnowledge,
    buildSourceHints
};

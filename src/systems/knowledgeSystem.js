const { OpenAI } = require('openai');
const {
    createKnowledgeEntry,
    createKnowledgeEvent,
    searchKnowledgeEntriesRanked,
    getThreadKnowledgeEntries,
    getKnowledgeEntryById,
    markKnowledgeEntryAccepted,
    unacceptKnowledgeEntry,
    listKnowledgeEntries,
    countKnowledgeEntries,
    addKnowledgeFeedbackEvent,
    hasUserFeedbackForAsk,
    getAskContextSourceEntryIds,
    aggregateKnowledgeFeedback,
    upsertFeedbackReview,
    getFeedbackReview,
    getKnowledgeHealthStats,
    getTopProblemKnowledgeEntries,
    getFeedbackReviewStatusCounts
} = require('../repositories/knowledgeRepository');
const { hasModerationPermission, hasManageGuildPermission } = require('../utils/permissions');
const { logModerationEvent } = require('./logSystem');
const { truncateText } = require('../utils/message');
const { parseKnowledgeId, formatKnowledgeId, createKnowledgeExcerpt, formatIsoTimestamp } = require('../utils/knowledgeFormatting');
const { normalizeDiscordChannelName } = require('../lib/discordChannelName');
const { aiWarn, aiError, formatError } = require('../utils/logger');

const MIN_CONTENT_LENGTH = 40;
const MAX_INGEST_CONTENT = 3000;
const DEFAULT_SEARCH_LIMIT = 5;
const MIN_ASK_CONFIDENCE = 0.42;
const ASK_FEEDBACK_PREFIX = 'knowledge_feedback_';

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
    ].filter(Boolean).map(normalizeDiscordChannelName));
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
    if (!message?.content) return { ok: false, reason: 'low-value-content' };
    if (message.content.trim().startsWith('/')) return { ok: false, reason: 'slash-command-like' };
    if (isEmojiOnlyOrNoise(message.content)) return { ok: false, reason: 'emoji-or-noise' };
    if (isSmalltalkMessage(message.content)) return { ok: false, reason: 'smalltalk' };
    if (message.content.trim().length < MIN_CONTENT_LENGTH) return { ok: false, reason: 'low-value-content' };
    if (!hasCodingSignal(message.content) && message.content.trim().length < 90) return { ok: false, reason: 'low-signal-non-technical' };

    const relevantChannels = buildRelevantChannelSet(config);
    if (!relevantChannels.has(normalizeDiscordChannelName(message.channel?.name))) return { ok: false, reason: 'irrelevant-channel' };

    return { ok: true, reason: 'accepted' };
}

function isEmojiOnlyOrNoise(content) {
    const stripped = String(content || '')
        .replace(/<a?:\w+:\d+>/g, '')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .replace(/[\s!?.:,;~`'"()\-\[\]{}<>|/\\*_+=]/g, '');
    return stripped.length === 0;
}

function isSmalltalkMessage(content) {
    const normalized = String(content || '').trim().toLowerCase();
    if (!normalized) return true;
    const short = normalized.length <= 80;
    const patterns = [
        /^danke+!?$/,
        /^thx+!?$/,
        /^thanks+!?$/,
        /^nice+!?$/,
        /^ok+!?$/,
        /^cool+!?$/,
        /^gg+!?$/,
        /^super+!?$/
    ];
    return short && patterns.some(re => re.test(normalized));
}

function hasCodingSignal(content) {
    const text = String(content || '').toLowerCase();
    const patterns = [
        /```/,
        /\b(error|exception|stacktrace|traceback|bug|fix|debug)\b/,
        /\b(function|class|const|let|var|import|export|return)\b/,
        /\b(api|endpoint|sql|query|schema|migration|docker|kubernetes|ci|cd)\b/,
        /\b(node|javascript|typescript|python|react|nextjs|discord\.js|sqlite)\b/
    ];
    return patterns.some(re => re.test(text));
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
    return `Ich habe lokale Knowledge-Eintraege gefunden, aber keine AI-Formulierung erzeugt.\nFrage: ${question}\n\nRelevante Treffer:\n${top}`;
}

function buildSourceHints(hits) {
    return hits.slice(0, 5).map((hit, index) => {
        const threadHint = hit.thread_id ? `thread=${hit.thread_id}` : 'thread=n/a';
        return `${index + 1}. channel=${hit.channel_id}, ${threadHint}, entry=${hit.id}`;
    }).join('\n');
}

async function askFromKnowledge(config, guildId, question, limit = DEFAULT_SEARCH_LIMIT) {
    const searchResult = searchKnowledgeEntriesRanked(guildId, question, limit);
    const hits = searchResult.rows;
    if (!hits.length) {
        return {
            ok: true,
            answer: 'Ich habe dazu keine verlaesslichen Treffer in der Knowledge-Base gefunden. Bitte gib mehr technischen Kontext (Code, Fehler, Stacktrace).',
            sources: [],
            confidence: 'low'
        };
    }

    const topScore = hits[0]?.retrieval_score || 0;
    const confidence = topScore >= 0.75 ? 'high' : topScore >= 0.55 ? 'medium' : 'low';
    if (topScore < MIN_ASK_CONFIDENCE) {
        return {
            ok: true,
            answer: 'Ich habe nur schwache Treffer gefunden und antworte deshalb nicht spekulativ. Bitte praezisiere die Frage oder teile mehr Details.',
            sources: hits,
            confidence: 'low'
        };
    }

    const aiClient = getAiClient(config);
    if (!aiClient) {
        return { ok: true, answer: buildAskFallbackAnswer(question, hits), sources: hits, confidence };
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
        return { ok: true, answer, sources: hits, confidence };
    } catch (err) {
        aiError('knowledge ask AI failed', { guildId, error: formatError(err) });
        return { ok: true, answer: buildAskFallbackAnswer(question, hits), sources: hits, confidence };
    }
}

function canAcceptKnowledgeEntry(interaction, entry) {
    if (!interaction?.user || interaction.user.bot) {
        return { ok: false, reason: 'Bots koennen keine Loesungen akzeptieren.' };
    }

    if (hasManageGuildPermission(interaction.member) || hasModerationPermission(interaction.member)) {
        return { ok: true, reason: 'moderator' };
    }

    const channelOwnerId = interaction.channel?.ownerId || null;
    if (channelOwnerId && String(channelOwnerId) === String(interaction.user.id)) {
        if (entry.thread_id && interaction.channel?.id === entry.thread_id) {
            return { ok: true, reason: 'thread-owner' };
        }
    }

    return { ok: false, reason: 'Du hast keine Berechtigung, diese Loesung zu akzeptieren.' };
}

function parseEntryId(value) {
    return parseKnowledgeId(value);
}

async function acceptKnowledgeSolution(interaction, config, options = {}) {
    const entryId = parseEntryId(options.entryId);
    if (!entryId) {
        return { ok: false, code: 'invalid-entry-id', message: 'Ungueltige entry_id. Bitte eine positive Zahl angeben.' };
    }

    const entry = getKnowledgeEntryById(interaction.guildId, entryId);
    if (!entry) {
        return { ok: false, code: 'not-found', message: `Knowledge Entry ${entryId} wurde nicht gefunden.` };
    }

    const permission = canAcceptKnowledgeEntry(interaction, entry);
    if (!permission.ok) {
        return { ok: false, code: 'permission-denied', message: permission.reason };
    }

    if (entry.is_accepted_solution) {
        return {
            ok: true,
            code: 'already-accepted',
            message: `Entry ${entryId} ist bereits als Accepted Solution markiert.`,
            entry
        };
    }

    const acceptedAt = new Date().toISOString();
    markKnowledgeEntryAccepted(interaction.guildId, entryId, interaction.user.id, acceptedAt);
    createKnowledgeEvent({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        threadId: entry.thread_id || null,
        messageId: entry.source_message_id || null,
        eventType: 'solution.accepted',
        details: `entry_id=${entryId};accepted_by=${interaction.user.id};reason=${options.reason || ''}`,
        createdAt: acceptedAt
    });

    await logModerationEvent(
        interaction.guild,
        config,
        `knowledge.accept | entryId=${entryId} | by=${interaction.user.tag} (${interaction.user.id}) | reason=${options.reason || 'n/a'}`
    );

    return {
        ok: true,
        code: 'accepted',
        message: `Entry ${entryId} wurde als Accepted Solution markiert.`,
        entryId,
        acceptedBy: interaction.user.id,
        acceptedAt
    };
}

function canShowKnowledgeEntry(interaction, entry) {
    if (!interaction?.user || interaction.user.bot) {
        return { ok: false, reason: 'Bots duerfen diesen Command nicht ausfuehren.' };
    }
    if (hasManageGuildPermission(interaction.member) || hasModerationPermission(interaction.member)) {
        return { ok: true, reason: 'moderator' };
    }
    const channelOwnerId = interaction.channel?.ownerId || null;
    if (channelOwnerId && String(channelOwnerId) === String(interaction.user.id)) {
        if (entry.thread_id && interaction.channel?.id === entry.thread_id) {
            return { ok: true, reason: 'thread-owner' };
        }
    }
    return { ok: false, reason: 'Du hast keine Berechtigung, diesen Knowledge Entry einzusehen.' };
}

function formatKnowledgeEntryPreview(entry) {
    const excerpt = truncateText(String(entry.content || '').replace(/\s+/g, ' ').trim(), 450) || 'n/a';
    return [
        `Entry ID: ${entry.id}`,
        `Titel: ${entry.title || 'n/a'}`,
        `Inhalt: ${excerpt}`,
        `Channel: ${entry.channel_id || 'n/a'}`,
        `Thread: ${entry.thread_id || 'n/a'}`,
        `Source Type: ${entry.source_type || 'n/a'}`,
        `Source Message: ${entry.source_message_id || 'n/a'}`,
        `Accepted: ${entry.is_accepted_solution ? 'yes' : 'no'}`,
        `Accepted By: ${entry.accepted_by || 'n/a'}`,
        `Accepted At: ${entry.accepted_at || 'n/a'}`,
        `Created At: ${entry.created_at || 'n/a'}`
    ].join('\n');
}

function getKnowledgeEntryDetails(interaction, options = {}) {
    const entryId = parseEntryId(options.entryId);
    if (!entryId) {
        return { ok: false, code: 'invalid-entry-id', message: 'Ungueltige entry_id. Bitte eine positive Zahl angeben.' };
    }
    const entry = getKnowledgeEntryById(interaction.guildId, entryId);
    if (!entry) {
        return { ok: false, code: 'not-found', message: `Knowledge Entry ${entryId} wurde nicht gefunden.` };
    }
    const permission = canShowKnowledgeEntry(interaction, entry);
    if (!permission.ok) {
        return { ok: false, code: 'permission-denied', message: permission.reason };
    }
    return {
        ok: true,
        code: 'found',
        message: formatKnowledgeEntryPreview(entry),
        entry
    };
}

async function unacceptKnowledgeSolution(interaction, config, options = {}) {
    const entryId = parseEntryId(options.entryId);
    if (!entryId) {
        return { ok: false, code: 'invalid-entry-id', message: 'Ungueltige entry_id. Bitte eine positive Zahl angeben.' };
    }
    const entry = getKnowledgeEntryById(interaction.guildId, entryId);
    if (!entry) {
        return { ok: false, code: 'not-found', message: `Knowledge Entry ${entryId} wurde nicht gefunden.` };
    }

    if (!(hasManageGuildPermission(interaction.member) || hasModerationPermission(interaction.member))) {
        return { ok: false, code: 'permission-denied', message: 'Nur Moderatoren/Admins duerfen Accepted Solutions zuruecksetzen.' };
    }

    if (!entry.is_accepted_solution) {
        return {
            ok: true,
            code: 'already-unaccepted',
            message: `Entry ${entryId} ist bereits nicht als Accepted Solution markiert.`
        };
    }

    unacceptKnowledgeEntry(interaction.guildId, entryId);
    const now = new Date().toISOString();
    createKnowledgeEvent({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        threadId: entry.thread_id || null,
        messageId: entry.source_message_id || null,
        eventType: 'solution.unaccepted',
        details: `entry_id=${entryId};unaccepted_by=${interaction.user.id};reason=${options.reason || ''}`,
        createdAt: now
    });

    await logModerationEvent(
        interaction.guild,
        config,
        `knowledge.unaccept | entryId=${entryId} | by=${interaction.user.tag} (${interaction.user.id}) | reason=${options.reason || 'n/a'}`
    );

    return {
        ok: true,
        code: 'unaccepted',
        message: `Entry ${entryId} wurde als Accepted Solution zurueckgesetzt.`
    };
}

function canListKnowledge(interaction, filter) {
    if (hasManageGuildPermission(interaction.member) || hasModerationPermission(interaction.member)) {
        return { ok: true, reason: 'moderator' };
    }

    if (filter === 'thread') {
        const channelOwnerId = interaction.channel?.ownerId || null;
        const isThread = typeof interaction.channel?.isThread === 'function' && interaction.channel.isThread();
        if (isThread && channelOwnerId && String(channelOwnerId) === String(interaction.user?.id)) {
            return { ok: true, reason: 'thread-owner' };
        }
    }

    return { ok: false, reason: 'Du hast keine Berechtigung fuer diesen Knowledge-List-Command.' };
}

function normalizeListFilter(value) {
    const allowed = new Set(['recent', 'accepted', 'unaccepted', 'thread']);
    const v = String(value || 'recent').trim().toLowerCase();
    return allowed.has(v) ? v : 'recent';
}

function formatKnowledgeList(entries, filter) {
    if (!entries.length) {
        return `Keine Knowledge Entries fuer Filter "${filter}" gefunden.`;
    }

    const lines = entries.map(entry => {
        const marker = entry.is_accepted_solution ? '[A]' : '[ ]';
        const preview = truncateText((entry.title || entry.content || 'n/a').replace(/\s+/g, ' ').trim(), 70);
        const scope = entry.thread_id ? `thread=${entry.thread_id}` : `channel=${entry.channel_id}`;
        return `${marker} #${entry.id} | ${preview} | ${entry.created_at} | ${scope}`;
    });

    return [`Knowledge List (${filter})`, ...lines].join('\n');
}

function listKnowledgeEntriesForCuration(interaction, options = {}) {
    const filter = normalizeListFilter(options.filter);
    const limit = Math.max(1, Math.min(25, Number(options.limit || 10)));
    const offset = Math.max(0, Number(options.offset || 0));
    const permission = canListKnowledge(interaction, filter);
    if (!permission.ok) {
        return { ok: false, code: 'permission-denied', message: permission.reason };
    }

    if (filter === 'thread') {
        const isThread = typeof interaction.channel?.isThread === 'function' && interaction.channel.isThread();
        if (!isThread) {
            return { ok: false, code: 'thread-required', message: 'Filter "thread" funktioniert nur innerhalb eines Threads.' };
        }
    }

    const threadId = filter === 'thread' ? interaction.channel?.id : null;
    const entries = listKnowledgeEntries(interaction.guildId, { filter, limit, offset, threadId });
    const total = countKnowledgeEntries(interaction.guildId, { filter, threadId });
    return {
        ok: true,
        code: entries.length ? 'list-found' : 'list-empty',
        message: formatKnowledgeList(entries, filter),
        entries,
        total,
        shown: entries.length,
        offset,
        limit,
        filter
    };
}

function normalizeFeedbackFilter(type) {
    const value = String(type || 'all').toLowerCase();
    if (value === 'outdated') return 'outdated';
    if (value === 'not_helpful') return 'not_helpful';
    if (value === 'helpful') return 'helpful';
    return 'all';
}

function normalizeFeedbackStatus(status) {
    const value = String(status || 'open').toLowerCase();
    if (value === 'open' || value === 'reviewed' || value === 'resolved' || value === 'ignored' || value === 'all') return value;
    return 'open';
}

function canViewFeedback(interaction) {
    return hasManageGuildPermission(interaction.member) || hasModerationPermission(interaction.member);
}

function normalizeHealthWindow(windowValue) {
    const w = String(windowValue || '7d').toLowerCase();
    if (w === '24h' || w === '7d' || w === '30d' || w === 'all') return w;
    return '7d';
}

function mapFeedbackTitle(type) {
    if (type === 'outdated') return '⚠️ Knowledge Feedback: Outdated';
    if (type === 'not_helpful') return '🟠 Knowledge Feedback: Not Helpful';
    if (type === 'helpful') return '🟢 Knowledge Feedback: Helpful';
    return 'Knowledge Feedback Overview';
}

function handleKnowledgeFeedbackList(interaction, options = {}) {
    if (!canViewFeedback(interaction)) {
        return { ok: false, code: 'permission-denied', message: 'Nur Moderatoren/Admins duerfen Feedback-Events einsehen.' };
    }

    const type = normalizeFeedbackFilter(options.type);
    const status = normalizeFeedbackStatus(options.status);
    const limit = Math.max(1, Math.min(25, Number(options.limit || 10)));
    const items = aggregateKnowledgeFeedback({
        guildId: interaction.guildId,
        type,
        status,
        limit
    });

    if (!items.length) {
        return {
            ok: true,
            code: 'empty',
            title: mapFeedbackTitle(type),
            message: 'Keine Feedback-Eintraege gefunden.',
            lines: [],
            type,
            status,
            total: 0
        };
    }

    const lines = items.map(item => {
        const ids = item.sourceEntryIds.slice(0, 5).map(id => formatKnowledgeId(id)).join(', ') || 'n/a';
        const firstEntry = item.sourceEntryIds.length ? getKnowledgeEntryById(interaction.guildId, item.sourceEntryIds[0]) : null;
        const excerpt = firstEntry ? createKnowledgeExcerpt(firstEntry.title || firstEntry.content, 70) : 'n/a';
        return [
            `Type: ${item.eventType}`,
            `Count: ${item.count}`,
            `Last: ${formatIsoTimestamp(item.lastAt)}`,
            `Status: ${item.reviewStatus || 'open'}`,
            `Ask Context: ${item.askContextId || 'n/a'}`,
            `Sources: ${ids}`,
            `Excerpt: ${excerpt}`
        ].join(' | ');
    });

    return {
        ok: true,
        code: 'found',
        title: mapFeedbackTitle(type),
        message: `Showing ${lines.length} items`,
        lines,
        type,
        status,
        total: lines.length
    };
}

function mapReviewStatusToEvent(status, previousStatus) {
    if (status === 'resolved') return 'feedback.resolved';
    if (status === 'ignored') return 'feedback.ignored';
    if (status === 'reviewed') return 'feedback.reviewed';
    if (status === 'open' && previousStatus && previousStatus !== 'open') return 'feedback.reopened';
    if (status === 'open') return 'feedback.reopened';
    return 'feedback.reviewed';
}

async function handleKnowledgeFeedbackReview(interaction, options = {}) {
    if (!canViewFeedback(interaction)) {
        return { ok: false, code: 'permission-denied', message: 'Nur Moderatoren/Admins duerfen Feedback-Reviews setzen.' };
    }

    const askContextId = String(options.askContextId || '').trim();
    const type = normalizeFeedbackFilter(options.type);
    const status = normalizeFeedbackStatus(options.status);
    const note = String(options.note || '').trim();

    if (!askContextId) {
        return { ok: false, code: 'invalid-ask-context', message: 'ask_context_id ist erforderlich.' };
    }
    if (type === 'all') {
        return { ok: false, code: 'invalid-feedback-type', message: 'Für review-feedback muss ein konkreter Feedback-Typ gewählt werden.' };
    }
    if (status === 'all') {
        return { ok: false, code: 'invalid-status', message: 'Für review-feedback muss ein konkreter Status gewählt werden.' };
    }

    const eventTypeForRepo = `ask.feedback.${type}`;
    const previous = getFeedbackReview(interaction.guildId, askContextId, eventTypeForRepo);
    const now = new Date().toISOString();
    upsertFeedbackReview({
        guildId: interaction.guildId,
        askContextId,
        feedbackType: eventTypeForRepo,
        status,
        reviewedBy: interaction.user.id,
        reviewedAt: now,
        note,
        updatedAt: now
    });

    const lifecycleEvent = mapReviewStatusToEvent(status, previous?.status || null);
    createKnowledgeEvent({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        threadId: interaction.channel?.isThread?.() ? interaction.channel.id : null,
        messageId: null,
        userId: interaction.user.id,
        askContextId,
        eventType: lifecycleEvent,
        details: JSON.stringify({
            feedbackType: eventTypeForRepo,
            status,
            note
        }),
        createdAt: now
    });

    return {
        ok: true,
        code: 'review-upserted',
        message: `Feedback-Review aktualisiert: ${askContextId} | ${type} -> ${status}`,
        askContextId,
        type,
        status
    };
}

function ratio(part, total) {
    if (!total) return '0.0%';
    return `${((part / total) * 100).toFixed(1)}%`;
}

function ratioNumber(part, total) {
    if (!total) return null;
    return (part / total) * 100;
}

const MIN_RATIO_FEEDBACK_VOLUME = 5;
const MIN_ASK_RESPONSE_VOLUME = 5;
const MIN_REVIEW_VOLUME = 3;

function naLowVolume() {
    return 'n/a (low volume)';
}

function trendSymbol(current, previous, mode = 'higher_better') {
    if (previous === null || previous === undefined) return 'n/a';
    if (current === null || current === undefined) return 'n/a';
    const epsilon = 0.0001;
    if (Math.abs(current - previous) < epsilon) return '→ stabil';
    if (mode === 'neutral') return current > previous ? '↑ mehr Aktivität' : '↓ weniger Aktivität';
    if (mode === 'higher_better') return current > previous ? '↑ besser' : '↓ schlechter';
    return current > previous ? '↓ schlechter' : '↑ besser';
}

function hasMinimumTrendVolume(kind, currentVolume, previousVolume) {
    if (kind === 'ratio') {
        return currentVolume >= MIN_RATIO_FEEDBACK_VOLUME && previousVolume >= MIN_RATIO_FEEDBACK_VOLUME;
    }
    if (kind === 'ask') {
        return currentVolume >= MIN_ASK_RESPONSE_VOLUME || previousVolume >= MIN_ASK_RESPONSE_VOLUME;
    }
    if (kind === 'review') {
        return currentVolume >= MIN_REVIEW_VOLUME || previousVolume >= MIN_REVIEW_VOLUME;
    }
    return true;
}

function handleKnowledgeHealth(interaction, options = {}) {
    if (!canViewFeedback(interaction)) {
        return { ok: false, code: 'permission-denied', message: 'Nur Moderatoren/Admins duerfen das Knowledge Health Dashboard einsehen.' };
    }

    const window = normalizeHealthWindow(options.window || '7d');
    const stats = getKnowledgeHealthStats({ guildId: interaction.guildId, window });
    const triage = getFeedbackReviewStatusCounts({ guildId: interaction.guildId, window });
    const topProblems = getTopProblemKnowledgeEntries({ guildId: interaction.guildId, window, limit: 5 });

    const openFeedbackCount = Number(triage.open || 0);
    const resolvedFeedbackCount = Number(triage.resolved || 0);
    const feedbackTotal = stats.helpfulCount + stats.notHelpfulCount + stats.outdatedCount;
    let trends = null;

    if (window === 'all') {
        trends = {
            helpfulRatio: 'n/a',
            notHelpfulRatio: 'n/a',
            outdatedRatio: 'n/a',
            askResponsesCount: 'n/a',
            openFeedbackCount: 'n/a',
            resolvedFeedbackCount: 'n/a',
            note: 'Trend unavailable for all-time window'
        };
    } else {
        const prevStats = getKnowledgeHealthStats({ guildId: interaction.guildId, window, offsetWindow: 1 });
        const prevTriage = getFeedbackReviewStatusCounts({ guildId: interaction.guildId, window, offsetWindow: 1 });
        const prevFeedbackTotal = prevStats.helpfulCount + prevStats.notHelpfulCount + prevStats.outdatedCount;
        const currReviewTotal = Number(triage.open || 0) + Number(triage.reviewed || 0) + Number(triage.resolved || 0) + Number(triage.ignored || 0);
        const prevReviewTotal = Number(prevTriage.open || 0) + Number(prevTriage.reviewed || 0) + Number(prevTriage.resolved || 0) + Number(prevTriage.ignored || 0);

        const currHelpfulRatio = ratioNumber(stats.helpfulCount, feedbackTotal);
        const currNotHelpfulRatio = ratioNumber(stats.notHelpfulCount, feedbackTotal);
        const currOutdatedRatio = ratioNumber(stats.outdatedCount, feedbackTotal);
        const prevHelpfulRatio = ratioNumber(prevStats.helpfulCount, prevFeedbackTotal);
        const prevNotHelpfulRatio = ratioNumber(prevStats.notHelpfulCount, prevFeedbackTotal);
        const prevOutdatedRatio = ratioNumber(prevStats.outdatedCount, prevFeedbackTotal);

        trends = {
            helpfulRatio: hasMinimumTrendVolume('ratio', feedbackTotal, prevFeedbackTotal)
                ? trendSymbol(currHelpfulRatio, prevHelpfulRatio, 'higher_better')
                : naLowVolume(),
            notHelpfulRatio: hasMinimumTrendVolume('ratio', feedbackTotal, prevFeedbackTotal)
                ? trendSymbol(currNotHelpfulRatio, prevNotHelpfulRatio, 'lower_better')
                : naLowVolume(),
            outdatedRatio: hasMinimumTrendVolume('ratio', feedbackTotal, prevFeedbackTotal)
                ? trendSymbol(currOutdatedRatio, prevOutdatedRatio, 'lower_better')
                : naLowVolume(),
            askResponsesCount: hasMinimumTrendVolume('ask', stats.askResponsesCount, prevStats.askResponsesCount)
                ? trendSymbol(stats.askResponsesCount, prevStats.askResponsesCount, 'neutral')
                : naLowVolume(),
            openFeedbackCount: hasMinimumTrendVolume('review', currReviewTotal, prevReviewTotal)
                ? trendSymbol(openFeedbackCount, Number(prevTriage.open || 0), 'lower_better')
                : naLowVolume(),
            resolvedFeedbackCount: hasMinimumTrendVolume('review', currReviewTotal, prevReviewTotal)
                ? trendSymbol(resolvedFeedbackCount, Number(prevTriage.resolved || 0), 'higher_better')
                : naLowVolume(),
            note: null
        };
    }

    return {
        ok: true,
        window,
        summary: {
            askResponsesCount: stats.askResponsesCount,
            helpfulCount: stats.helpfulCount,
            notHelpfulCount: stats.notHelpfulCount,
            outdatedCount: stats.outdatedCount,
            openFeedbackCount,
            resolvedFeedbackCount
        },
        quality: {
            helpfulRatio: ratio(stats.helpfulCount, feedbackTotal),
            outdatedRatio: ratio(stats.outdatedCount, feedbackTotal),
            notHelpfulRatio: ratio(stats.notHelpfulCount, feedbackTotal),
            acceptedSolutionsCount: stats.acceptedSolutionsCount,
            lowConfidenceAnswerCount: stats.lowConfidenceCount
        },
        trends,
        topProblems,
        triage
    };
}

function createAskContextId() {
    const ts = Date.now().toString(36).slice(-6);
    const rnd = Math.random().toString(36).slice(2, 6);
    return `${ts}${rnd}`;
}

function registerAskResponseContext(interaction, question, askResult) {
    const askContextId = createAskContextId();
    addKnowledgeFeedbackEvent({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        threadId: interaction.channel?.isThread?.() ? interaction.channel.id : null,
        messageId: null,
        userId: interaction.user?.id || null,
        askContextId,
        eventType: 'ask.response',
        details: {
            question: truncateText(question, 500),
            confidence: askResult.confidence || 'low',
            sourceEntryIds: (askResult.sources || []).map(item => item.id).filter(Boolean)
        }
    });
    return askContextId;
}

function parseAskFeedbackCustomId(customId) {
    const match = String(customId || '').match(/^knowledge_feedback_(helpful|not_helpful|outdated):([a-z0-9]{6,20})$/i);
    if (!match) return null;
    return {
        type: match[1].toLowerCase(),
        askContextId: match[2]
    };
}

async function handleAskFeedbackInteraction(interaction) {
    if (!interaction?.isButton?.()) return { handled: false };
    if (!String(interaction.customId || '').startsWith(ASK_FEEDBACK_PREFIX)) return { handled: false };

    const parsed = parseAskFeedbackCustomId(interaction.customId);
    if (!parsed) {
        await interaction.reply({ content: 'Ungueltiges Feedback-Format.', flags: 64 });
        return { handled: true, ok: false };
    }

    const eventMap = {
        helpful: 'ask.feedback.helpful',
        not_helpful: 'ask.feedback.not_helpful',
        outdated: 'ask.feedback.outdated'
    };
    const eventType = eventMap[parsed.type];
    if (!eventType) {
        await interaction.reply({ content: 'Unbekannter Feedback-Typ.', flags: 64 });
        return { handled: true, ok: false };
    }

    const alreadySent = hasUserFeedbackForAsk(interaction.guildId, parsed.askContextId, interaction.user.id, eventType);
    if (alreadySent) {
        await interaction.reply({ content: 'Feedback bereits gespeichert. Danke.', flags: 64 });
        return { handled: true, ok: true, duplicate: true };
    }

    const sourceEntryIds = getAskContextSourceEntryIds(interaction.guildId, parsed.askContextId);
    addKnowledgeFeedbackEvent({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        threadId: interaction.channel?.isThread?.() ? interaction.channel.id : null,
        messageId: interaction.message?.id || null,
        userId: interaction.user.id,
        askContextId: parsed.askContextId,
        eventType,
        details: {
            sourceEntryIds,
            label: parsed.type
        }
    });

    await interaction.reply({ content: 'Danke, Feedback gespeichert.', flags: 64 });
    return { handled: true, ok: true, duplicate: false };
}

module.exports = {
    MIN_CONTENT_LENGTH,
    shouldIngestMessage,
    ingestKnowledgeFromMessage,
    summarizeCurrentThread,
    askFromKnowledge,
    buildSourceHints,
    isSmalltalkMessage,
    hasCodingSignal,
    isEmojiOnlyOrNoise,
    parseEntryId,
    canAcceptKnowledgeEntry,
    acceptKnowledgeSolution,
    canShowKnowledgeEntry,
    getKnowledgeEntryDetails,
    unacceptKnowledgeSolution,
    canListKnowledge,
    listKnowledgeEntriesForCuration,
    createAskContextId,
    registerAskResponseContext,
    parseAskFeedbackCustomId,
    handleAskFeedbackInteraction,
    handleKnowledgeFeedbackList,
    handleKnowledgeFeedbackReview,
    handleKnowledgeHealth
};


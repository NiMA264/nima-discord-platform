const { getDatabase } = require('../database/database');

const db = getDatabase();

const statements = {
    createEntry: db.prepare(`
        INSERT INTO knowledge_entries (
            guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, is_accepted_solution, accepted_by, accepted_at, created_by, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    createEvent: db.prepare(`
        INSERT INTO knowledge_events (
            guild_id, channel_id, thread_id, message_id, user_id, ask_context_id, event_type, details, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    searchEntriesLike: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at
               , is_accepted_solution, accepted_by, accepted_at
        FROM knowledge_entries
        WHERE guild_id = ?
          AND (
            LOWER(title) LIKE LOWER(?)
            OR LOWER(content) LIKE LOWER(?)
            OR LOWER(tags) LIKE LOWER(?)
          )
        ORDER BY id DESC
        LIMIT ?
    `),
    searchEntriesFts: db.prepare(`
        SELECT ke.id, ke.guild_id, ke.channel_id, ke.thread_id, ke.source_message_id, ke.source_type, ke.title, ke.content, ke.tags, ke.created_by, ke.created_at,
               ke.is_accepted_solution, ke.accepted_by, ke.accepted_at,
               bm25(knowledge_entries_fts) AS bm25_score
        FROM knowledge_entries_fts
        JOIN knowledge_entries ke ON ke.id = knowledge_entries_fts.rowid
        WHERE ke.guild_id = ?
          AND knowledge_entries_fts MATCH ?
        ORDER BY bm25(knowledge_entries_fts) ASC
        LIMIT ?
    `),
    getThreadEntries: db.prepare(`
        SELECT id, title, content, created_at, source_message_id
        FROM knowledge_entries
        WHERE guild_id = ? AND thread_id = ? AND source_type = 'message'
        ORDER BY id DESC
        LIMIT ?
    `),
    getEntryById: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at,
               is_accepted_solution, accepted_by, accepted_at
        FROM knowledge_entries
        WHERE guild_id = ? AND id = ?
        LIMIT 1
    `),
    markAcceptedSolution: db.prepare(`
        UPDATE knowledge_entries
        SET is_accepted_solution = 1,
            accepted_by = ?,
            accepted_at = ?
        WHERE guild_id = ? AND id = ? AND is_accepted_solution = 0
    `),
    unacceptSolution: db.prepare(`
        UPDATE knowledge_entries
        SET is_accepted_solution = 0,
            accepted_by = NULL,
            accepted_at = NULL
        WHERE guild_id = ? AND id = ? AND is_accepted_solution = 1
    `),
    listRecent: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at,
               is_accepted_solution, accepted_by, accepted_at
        FROM knowledge_entries
        WHERE guild_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `),
    listAccepted: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at,
               is_accepted_solution, accepted_by, accepted_at
        FROM knowledge_entries
        WHERE guild_id = ? AND is_accepted_solution = 1
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `),
    listUnaccepted: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at,
               is_accepted_solution, accepted_by, accepted_at
        FROM knowledge_entries
        WHERE guild_id = ? AND is_accepted_solution = 0
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `),
    listByThread: db.prepare(`
        SELECT id, guild_id, channel_id, thread_id, source_message_id, source_type, title, content, tags, created_by, created_at,
               is_accepted_solution, accepted_by, accepted_at
        FROM knowledge_entries
        WHERE guild_id = ? AND thread_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `),
    countRecent: db.prepare(`
        SELECT COUNT(*) AS total
        FROM knowledge_entries
        WHERE guild_id = ?
    `),
    countAccepted: db.prepare(`
        SELECT COUNT(*) AS total
        FROM knowledge_entries
        WHERE guild_id = ? AND is_accepted_solution = 1
    `),
    countUnaccepted: db.prepare(`
        SELECT COUNT(*) AS total
        FROM knowledge_entries
        WHERE guild_id = ? AND is_accepted_solution = 0
    `),
    countByThread: db.prepare(`
        SELECT COUNT(*) AS total
        FROM knowledge_entries
        WHERE guild_id = ? AND thread_id = ?
    `),
    hasUserFeedbackForAsk: db.prepare(`
        SELECT 1 AS found
        FROM knowledge_events
        WHERE guild_id = ?
          AND ask_context_id = ?
          AND user_id = ?
          AND event_type = ?
        LIMIT 1
    `),
    getAskContextEvent: db.prepare(`
        SELECT details
        FROM knowledge_events
        WHERE guild_id = ?
          AND ask_context_id = ?
          AND event_type = 'ask.response'
        ORDER BY id DESC
        LIMIT 1
    `),
    listFeedbackRawByType: db.prepare(`
        SELECT ask_context_id, event_type, details, created_at
        FROM knowledge_events
        WHERE guild_id = ?
          AND event_type = ?
        ORDER BY id DESC
        LIMIT ?
    `),
    listFeedbackRawAll: db.prepare(`
        SELECT ask_context_id, event_type, details, created_at
        FROM knowledge_events
        WHERE guild_id = ?
          AND event_type IN ('ask.feedback.helpful', 'ask.feedback.not_helpful', 'ask.feedback.outdated')
        ORDER BY id DESC
        LIMIT ?
    `),
    upsertFeedbackReview: db.prepare(`
        INSERT INTO knowledge_feedback_reviews (
            guild_id, ask_context_id, feedback_type, status, reviewed_by, reviewed_at, note, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, ask_context_id, feedback_type) DO UPDATE SET
            status = excluded.status,
            reviewed_by = excluded.reviewed_by,
            reviewed_at = excluded.reviewed_at,
            note = excluded.note,
            updated_at = excluded.updated_at
    `),
    getFeedbackReview: db.prepare(`
        SELECT id, guild_id, ask_context_id, feedback_type, status, reviewed_by, reviewed_at, note, created_at, updated_at
        FROM knowledge_feedback_reviews
        WHERE guild_id = ? AND ask_context_id = ? AND feedback_type = ?
        LIMIT 1
    `),
    listFeedbackReviewsAll: db.prepare(`
        SELECT id, guild_id, ask_context_id, feedback_type, status, reviewed_by, reviewed_at, note, created_at, updated_at
        FROM knowledge_feedback_reviews
        WHERE guild_id = ?
    `),
    listFeedbackReviewsByType: db.prepare(`
        SELECT id, guild_id, ask_context_id, feedback_type, status, reviewed_by, reviewed_at, note, created_at, updated_at
        FROM knowledge_feedback_reviews
        WHERE guild_id = ? AND feedback_type = ?
    `),
    listFeedbackReviewsByStatus: db.prepare(`
        SELECT id, guild_id, ask_context_id, feedback_type, status, reviewed_by, reviewed_at, note, created_at, updated_at
        FROM knowledge_feedback_reviews
        WHERE guild_id = ? AND status = ?
    `),
    listFeedbackReviewsByTypeAndStatus: db.prepare(`
        SELECT id, guild_id, ask_context_id, feedback_type, status, reviewed_by, reviewed_at, note, created_at, updated_at
        FROM knowledge_feedback_reviews
        WHERE guild_id = ? AND feedback_type = ? AND status = ?
    `),
    listKnowledgeEventsByType: db.prepare(`
        SELECT id, guild_id, ask_context_id, event_type, details, created_at
        FROM knowledge_events
        WHERE guild_id = ? AND event_type = ?
        ORDER BY id DESC
        LIMIT ?
    `),
    healthEventCounts: db.prepare(`
        SELECT
            SUM(CASE WHEN event_type = 'ask.response' THEN 1 ELSE 0 END) AS ask_responses,
            SUM(CASE WHEN event_type = 'ask.feedback.helpful' THEN 1 ELSE 0 END) AS helpful_count,
            SUM(CASE WHEN event_type = 'ask.feedback.not_helpful' THEN 1 ELSE 0 END) AS not_helpful_count,
            SUM(CASE WHEN event_type = 'ask.feedback.outdated' THEN 1 ELSE 0 END) AS outdated_count,
            SUM(CASE WHEN event_type = 'ask.response' AND details LIKE '%"confidence":"low"%' THEN 1 ELSE 0 END) AS low_confidence_count
        FROM knowledge_events
        WHERE guild_id = ?
          AND (? IS NULL OR created_at >= ?)
          AND (? IS NULL OR created_at < ?)
    `),
    healthAcceptedCount: db.prepare(`
        SELECT COUNT(*) AS accepted_solutions_count
        FROM knowledge_entries
        WHERE guild_id = ?
          AND is_accepted_solution = 1
          AND (? IS NULL OR created_at >= ?)
          AND (? IS NULL OR created_at < ?)
    `),
    healthFeedbackByContext: db.prepare(`
        SELECT ask_context_id, event_type, COUNT(*) AS cnt
        FROM knowledge_events
        WHERE guild_id = ?
          AND event_type IN ('ask.feedback.not_helpful', 'ask.feedback.outdated')
          AND ask_context_id IS NOT NULL
          AND (? IS NULL OR created_at >= ?)
        GROUP BY ask_context_id, event_type
    `),
    healthAskResponseByContext: db.prepare(`
        SELECT ask_context_id, details
        FROM knowledge_events
        WHERE guild_id = ?
          AND event_type = 'ask.response'
          AND ask_context_id IS NOT NULL
          AND (? IS NULL OR created_at >= ?)
        ORDER BY id DESC
    `),
    reviewStatusCounts: db.prepare(`
        SELECT status, COUNT(*) AS cnt
        FROM knowledge_feedback_reviews
        WHERE guild_id = ?
          AND (? IS NULL OR updated_at >= ?)
          AND (? IS NULL OR updated_at < ?)
        GROUP BY status
    `)
};

function createKnowledgeEntry(data) {
    return statements.createEntry.run(
        data.guildId,
        data.channelId,
        data.threadId || null,
        data.sourceMessageId || null,
        data.sourceType,
        data.title,
        data.content,
        data.tags || '',
        data.isAcceptedSolution ? 1 : 0,
        data.acceptedBy || null,
        data.acceptedAt || null,
        data.createdBy,
        data.createdAt
    );
}

function createKnowledgeEvent(data) {
    return statements.createEvent.run(
        data.guildId,
        data.channelId,
        data.threadId || null,
        data.messageId || null,
        data.userId || null,
        data.askContextId || null,
        data.eventType,
        data.details || '',
        data.createdAt
    );
}

function isFtsAvailable() {
    try {
        db.prepare('SELECT 1 FROM knowledge_entries_fts LIMIT 1').get();
        return true;
    } catch (err) {
        return false;
    }
}

function computeLikeHeuristicScore(row, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return 0;
    const title = String(row.title || '').toLowerCase();
    const content = String(row.content || '').toLowerCase();
    const tags = String(row.tags || '').toLowerCase();

    let score = 0;
    if (title.includes(q)) score += 0.55;
    if (content.includes(q)) score += 0.35;
    if (tags.includes(q)) score += 0.1;
    return Math.min(score, 0.95);
}

function buildFtsQuery(query) {
    const tokens = String(query || '')
        .toLowerCase()
        .split(/[^a-z0-9_]+/i)
        .map(token => token.trim())
        .filter(token => token.length >= 2);
    if (!tokens.length) return '';
    return tokens.map(token => `${token}*`).join(' OR ');
}

function scoreRetrievedRows(rows, query, mode) {
    return rows
        .map(row => {
            const acceptedBoost = row.is_accepted_solution ? 0.25 : 0;
            let baseScore = 0;

            if (mode === 'fts') {
                const bm25Score = Math.max(0, Number(row.bm25_score || 0));
                baseScore = 1 / (1 + bm25Score);
            } else {
                baseScore = computeLikeHeuristicScore(row, query);
            }

            const score = Math.min(1, baseScore + acceptedBoost);
            return { ...row, retrieval_score: score };
        })
        .sort((a, b) => b.retrieval_score - a.retrieval_score);
}

function searchKnowledgeEntriesRanked(guildId, query, limit = 5, options = {}) {
    const needle = `%${String(query || '').trim()}%`;
    const forceLike = Boolean(options.forceLike);

    if (!forceLike && isFtsAvailable()) {
        try {
            const ftsQuery = buildFtsQuery(query);
            if (!ftsQuery) {
                const likeRows = statements.searchEntriesLike.all(guildId, needle, needle, needle, limit);
                return { mode: 'like', rows: scoreRetrievedRows(likeRows, query, 'like') };
            }
            const rows = statements.searchEntriesFts.all(guildId, ftsQuery, limit);
            return { mode: 'fts', rows: scoreRetrievedRows(rows, query, 'fts') };
        } catch (err) {
            // fall back to LIKE path for robustness
        }
    }

    const likeRows = statements.searchEntriesLike.all(guildId, needle, needle, needle, limit);
    return { mode: 'like', rows: scoreRetrievedRows(likeRows, query, 'like') };
}

function searchKnowledgeEntries(guildId, query, limit = 5, options = {}) {
    return searchKnowledgeEntriesRanked(guildId, query, limit, options).rows;
}

function getThreadKnowledgeEntries(guildId, threadId, limit = 40) {
    return statements.getThreadEntries.all(guildId, threadId, limit).reverse();
}

function getKnowledgeEntryById(guildId, entryId) {
    return statements.getEntryById.get(guildId, entryId) || null;
}

function markKnowledgeEntryAccepted(guildId, entryId, acceptedBy, acceptedAt) {
    return statements.markAcceptedSolution.run(acceptedBy, acceptedAt, guildId, entryId);
}

function unacceptKnowledgeEntry(guildId, entryId) {
    return statements.unacceptSolution.run(guildId, entryId);
}

function listKnowledgeEntries(guildId, options = {}) {
    const limit = Math.max(1, Math.min(25, Number(options.limit || 10)));
    const offset = Math.max(0, Number(options.offset || 0));
    const filter = options.filter || 'recent';
    if (filter === 'accepted') return statements.listAccepted.all(guildId, limit, offset);
    if (filter === 'unaccepted') return statements.listUnaccepted.all(guildId, limit, offset);
    if (filter === 'thread') return statements.listByThread.all(guildId, options.threadId || '', limit, offset);
    return statements.listRecent.all(guildId, limit, offset);
}

function countKnowledgeEntries(guildId, options = {}) {
    const filter = options.filter || 'recent';
    if (filter === 'accepted') return Number(statements.countAccepted.get(guildId)?.total || 0);
    if (filter === 'unaccepted') return Number(statements.countUnaccepted.get(guildId)?.total || 0);
    if (filter === 'thread') return Number(statements.countByThread.get(guildId, options.threadId || '')?.total || 0);
    return Number(statements.countRecent.get(guildId)?.total || 0);
}

function addKnowledgeFeedbackEvent(data) {
    const details = typeof data.details === 'string'
        ? data.details
        : JSON.stringify(data.details || {});
    return createKnowledgeEvent({
        guildId: data.guildId,
        channelId: data.channelId,
        threadId: data.threadId || null,
        messageId: data.messageId || null,
        userId: data.userId,
        askContextId: data.askContextId,
        eventType: data.eventType,
        details,
        createdAt: data.createdAt || new Date().toISOString()
    });
}

function hasUserFeedbackForAsk(guildId, askContextId, userId, eventType) {
    return Boolean(statements.hasUserFeedbackForAsk.get(guildId, askContextId, userId, eventType));
}

function getAskContextSourceEntryIds(guildId, askContextId) {
    const row = statements.getAskContextEvent.get(guildId, askContextId);
    if (!row?.details) return [];
    try {
        const parsed = JSON.parse(row.details);
        return Array.isArray(parsed.sourceEntryIds) ? parsed.sourceEntryIds : [];
    } catch (err) {
        return [];
    }
}

function normalizeFeedbackType(type) {
    const value = String(type || 'all').toLowerCase();
    if (value === 'outdated' || value === 'ask.feedback.outdated') return 'ask.feedback.outdated';
    if (value === 'not_helpful' || value === 'ask.feedback.not_helpful') return 'ask.feedback.not_helpful';
    if (value === 'helpful' || value === 'ask.feedback.helpful') return 'ask.feedback.helpful';
    return 'all';
}

function listKnowledgeFeedback(options = {}) {
    const guildId = options.guildId;
    const limit = Math.max(1, Math.min(25, Number(options.limit || 10)));
    const normalizedType = normalizeFeedbackType(options.type);
    if (normalizedType === 'all') {
        return statements.listFeedbackRawAll.all(guildId, limit);
    }
    return statements.listFeedbackRawByType.all(guildId, normalizedType, limit);
}

function normalizeReviewStatus(status) {
    const value = String(status || 'all').toLowerCase();
    if (value === 'open' || value === 'reviewed' || value === 'resolved' || value === 'ignored' || value === 'all') return value;
    return 'all';
}

function upsertFeedbackReview(data) {
    const now = data.updatedAt || new Date().toISOString();
    const createdAt = data.createdAt || now;
    return statements.upsertFeedbackReview.run(
        data.guildId,
        data.askContextId,
        normalizeFeedbackType(data.feedbackType),
        normalizeReviewStatus(data.status) === 'all' ? 'open' : normalizeReviewStatus(data.status),
        data.reviewedBy || null,
        data.reviewedAt || now,
        data.note || '',
        createdAt,
        now
    );
}

function getFeedbackReview(guildId, askContextId, feedbackType) {
    return statements.getFeedbackReview.get(guildId, askContextId, normalizeFeedbackType(feedbackType)) || null;
}

function listFeedbackReviews(options = {}) {
    const guildId = options.guildId;
    const type = normalizeFeedbackType(options.type);
    const status = normalizeReviewStatus(options.status);
    if (type === 'all' && status === 'all') return statements.listFeedbackReviewsAll.all(guildId);
    if (type === 'all') return statements.listFeedbackReviewsByStatus.all(guildId, status);
    if (status === 'all') return statements.listFeedbackReviewsByType.all(guildId, type);
    return statements.listFeedbackReviewsByTypeAndStatus.all(guildId, type, status);
}

function aggregateKnowledgeFeedback(options = {}) {
    const rows = listKnowledgeFeedback(options);
    const reviews = listFeedbackReviews({
        guildId: options.guildId,
        type: options.type || 'all',
        status: 'all'
    });
    const reviewByKey = new Map();
    for (const review of reviews) {
        reviewByKey.set(`${review.ask_context_id}|${review.feedback_type}`, review);
    }
    const grouped = new Map();
    for (const row of rows) {
        const key = `${row.ask_context_id || 'n/a'}|${row.event_type}`;
        const current = grouped.get(key) || {
            askContextId: row.ask_context_id || null,
            eventType: row.event_type,
            count: 0,
            lastAt: row.created_at,
            sourceEntryIds: []
        };
        current.count += 1;
        if (String(row.created_at) > String(current.lastAt)) current.lastAt = row.created_at;
        try {
            const details = JSON.parse(row.details || '{}');
            const ids = Array.isArray(details.sourceEntryIds) ? details.sourceEntryIds : [];
            current.sourceEntryIds = Array.from(new Set([...current.sourceEntryIds, ...ids]));
        } catch (err) {
            // keep robust
        }
        const review = reviewByKey.get(key);
        if (review) {
            current.reviewStatus = review.status;
            current.reviewedBy = review.reviewed_by;
            current.reviewedAt = review.reviewed_at;
            current.reviewNote = review.note;
            current.reviewUpdatedAt = review.updated_at;
        } else {
            current.reviewStatus = 'open';
        }
        grouped.set(key, current);
    }
    const statusFilter = normalizeReviewStatus(options.status || 'all');
    const priority = {
        'ask.feedback.outdated': 0,
        'ask.feedback.not_helpful': 1,
        'ask.feedback.helpful': 2
    };
    return Array.from(grouped.values())
        .filter(item => statusFilter === 'all' ? true : item.reviewStatus === statusFilter)
        .sort((a, b) => {
            const pa = priority[a.eventType] ?? 9;
            const pb = priority[b.eventType] ?? 9;
            if (pa !== pb) return pa - pb;
            if (b.count !== a.count) return b.count - a.count;
            return String(b.lastAt).localeCompare(String(a.lastAt));
        })
        .slice(0, Math.max(1, Math.min(25, Number(options.limit || 10))));
}

function listKnowledgeEventsByType(guildId, eventType, limit = 20) {
    return statements.listKnowledgeEventsByType.all(guildId, eventType, Math.max(1, Math.min(200, Number(limit || 20))));
}

function windowToMs(window) {
    if (window === '24h') return 24 * 60 * 60 * 1000;
    if (window === '7d') return 7 * 24 * 60 * 60 * 1000;
    if (window === '30d') return 30 * 24 * 60 * 60 * 1000;
    return null;
}

function getWindowRange(window, offsetWindow = 0) {
    const durationMs = windowToMs(window);
    if (!durationMs) return { startIso: null, endIso: null };
    const now = Date.now();
    const end = now - (Math.max(0, Number(offsetWindow || 0)) * durationMs);
    const start = end - durationMs;
    return {
        startIso: new Date(start).toISOString(),
        endIso: new Date(end).toISOString()
    };
}

function getKnowledgeHealthStats(options = {}) {
    const guildId = options.guildId;
    const { startIso, endIso } = getWindowRange(options.window || '7d', options.offsetWindow || 0);
    const eventCounts = statements.healthEventCounts.get(guildId, startIso, startIso, endIso, endIso) || {};
    const acceptedRow = statements.healthAcceptedCount.get(guildId, startIso, startIso, endIso, endIso) || {};
    return {
        askResponsesCount: Number(eventCounts.ask_responses || 0),
        helpfulCount: Number(eventCounts.helpful_count || 0),
        notHelpfulCount: Number(eventCounts.not_helpful_count || 0),
        outdatedCount: Number(eventCounts.outdated_count || 0),
        lowConfidenceCount: Number(eventCounts.low_confidence_count || 0),
        acceptedSolutionsCount: Number(acceptedRow.accepted_solutions_count || 0)
    };
}

function getFeedbackReviewStatusCounts(options = {}) {
    const guildId = options.guildId;
    const { startIso, endIso } = getWindowRange(options.window || '7d', options.offsetWindow || 0);
    const rows = statements.reviewStatusCounts.all(guildId, startIso, startIso, endIso, endIso);
    const base = { open: 0, reviewed: 0, resolved: 0, ignored: 0 };
    for (const row of rows) {
        if (base[row.status] !== undefined) base[row.status] = Number(row.cnt || 0);
    }
    return base;
}

function getTopProblemKnowledgeEntries(options = {}) {
    const guildId = options.guildId;
    const limit = Math.max(1, Math.min(25, Number(options.limit || 10)));
    const { startIso } = getWindowRange(options.window || '7d', options.offsetWindow || 0);
    const feedbackRows = statements.healthFeedbackByContext.all(guildId, startIso, startIso);
    const askRows = statements.healthAskResponseByContext.all(guildId, startIso, startIso);
    const sourceByContext = new Map();
    for (const row of askRows) {
        if (sourceByContext.has(row.ask_context_id)) continue;
        try {
            const parsed = JSON.parse(row.details || '{}');
            sourceByContext.set(row.ask_context_id, Array.isArray(parsed.sourceEntryIds) ? parsed.sourceEntryIds : []);
        } catch (err) {
            sourceByContext.set(row.ask_context_id, []);
        }
    }

    const scoreByEntry = new Map();
    for (const row of feedbackRows) {
        const ids = sourceByContext.get(row.ask_context_id) || [];
        for (const id of ids) {
            const current = scoreByEntry.get(id) || { entryId: id, outdatedCount: 0, notHelpfulCount: 0 };
            if (row.event_type === 'ask.feedback.outdated') current.outdatedCount += Number(row.cnt || 0);
            if (row.event_type === 'ask.feedback.not_helpful') current.notHelpfulCount += Number(row.cnt || 0);
            scoreByEntry.set(id, current);
        }
    }

    const enriched = Array.from(scoreByEntry.values())
        .map(item => {
            const entry = getKnowledgeEntryById(guildId, item.entryId);
            return {
                ...item,
                totalCount: item.outdatedCount + item.notHelpfulCount,
                entry
            };
        })
        .filter(item => item.entry)
        .sort((a, b) => b.totalCount - a.totalCount)
        .slice(0, limit);

    return enriched;
}

module.exports = {
    createKnowledgeEntry,
    createKnowledgeEvent,
    isFtsAvailable,
    searchKnowledgeEntriesRanked,
    searchKnowledgeEntries,
    getThreadKnowledgeEntries,
    getKnowledgeEntryById,
    markKnowledgeEntryAccepted,
    unacceptKnowledgeEntry,
    listKnowledgeEntries,
    countKnowledgeEntries,
    addKnowledgeFeedbackEvent,
    hasUserFeedbackForAsk,
    getAskContextSourceEntryIds,
    listKnowledgeFeedback,
    aggregateKnowledgeFeedback,
    upsertFeedbackReview,
    getFeedbackReview,
    listFeedbackReviews,
    listKnowledgeEventsByType,
    getKnowledgeHealthStats,
    getTopProblemKnowledgeEntries,
    getFeedbackReviewStatusCounts
};

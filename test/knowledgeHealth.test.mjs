import { describe, it, expect } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';
import knowledgeCommand from '../src/commands/knowledge.js';

const {
    addKnowledgeFeedbackEvent,
    createKnowledgeEntry,
    getKnowledgeHealthStats,
    getTopProblemKnowledgeEntries,
    getFeedbackReviewStatusCounts,
    upsertFeedbackReview
} = knowledgeRepo;
const { handleKnowledgeHealth } = knowledgeSystem;

function makeInteraction({ guildId, isModerator }) {
    return {
        guildId,
        member: { permissions: { has: () => Boolean(isModerator) } }
    };
}

function seedHealthData(guildId, askContextId, eventType, confidence = 'medium') {
    const ins = createKnowledgeEntry({
        guildId,
        channelId: 'c1',
        threadId: 't1',
        sourceMessageId: 'm1',
        sourceType: 'message',
        title: 'Problematic source',
        content: 'Some problematic source content',
        tags: 'test',
        createdBy: 'u1',
        createdAt: new Date().toISOString()
    });
    const entryId = Number(ins.lastInsertRowid);
    addKnowledgeFeedbackEvent({
        guildId,
        channelId: 'c1',
        askContextId,
        userId: 'ask-user',
        eventType: 'ask.response',
        details: { confidence, sourceEntryIds: [entryId] }
    });
    addKnowledgeFeedbackEvent({
        guildId,
        channelId: 'c1',
        askContextId,
        userId: 'u2',
        eventType,
        details: { sourceEntryIds: [entryId] }
    });
    return entryId;
}

function daysAgoIso(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function seedFeedbackBatch({ guildId, dayOffset, responses, helpful = 0, notHelpful = 0, outdated = 0 }) {
    for (let i = 0; i < responses; i += 1) {
        addKnowledgeFeedbackEvent({
            guildId,
            channelId: 'c1',
            askContextId: `ctx${Date.now().toString(36).slice(-8)}r${i}${dayOffset}`,
            userId: `u-r-${i}`,
            eventType: 'ask.response',
            details: { confidence: 'medium' },
            createdAt: daysAgoIso(dayOffset)
        });
    }
    for (let i = 0; i < helpful; i += 1) {
        addKnowledgeFeedbackEvent({
            guildId,
            channelId: 'c1',
            askContextId: `ctx${Date.now().toString(36).slice(-8)}h${i}${dayOffset}`,
            userId: `u-h-${i}`,
            eventType: 'ask.feedback.helpful',
            details: {},
            createdAt: daysAgoIso(dayOffset)
        });
    }
    for (let i = 0; i < notHelpful; i += 1) {
        addKnowledgeFeedbackEvent({
            guildId,
            channelId: 'c1',
            askContextId: `ctx${Date.now().toString(36).slice(-8)}n${i}${dayOffset}`,
            userId: `u-n-${i}`,
            eventType: 'ask.feedback.not_helpful',
            details: {},
            createdAt: daysAgoIso(dayOffset)
        });
    }
    for (let i = 0; i < outdated; i += 1) {
        addKnowledgeFeedbackEvent({
            guildId,
            channelId: 'c1',
            askContextId: `ctx${Date.now().toString(36).slice(-8)}o${i}${dayOffset}`,
            userId: `u-o-${i}`,
            eventType: 'ask.feedback.outdated',
            details: {},
            createdAt: daysAgoIso(dayOffset)
        });
    }
}

describe('knowledge health dashboard', () => {
    it('repository returns health counts', () => {
        const guildId = `health-counts-${Date.now()}`;
        seedHealthData(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.helpful');
        const stats = getKnowledgeHealthStats({ guildId, window: 'all' });
        expect(stats.askResponsesCount).toBeGreaterThan(0);
        expect(stats.helpfulCount).toBeGreaterThan(0);
    });

    it('repository returns top problem entries', () => {
        const guildId = `health-top-${Date.now()}`;
        seedHealthData(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.outdated');
        const rows = getTopProblemKnowledgeEntries({ guildId, window: 'all', limit: 5 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].totalCount).toBeGreaterThan(0);
    });

    it('repository returns feedback review status counts', () => {
        const guildId = `health-status-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        upsertFeedbackReview({ guildId, askContextId, feedbackType: 'ask.feedback.outdated', status: 'resolved', reviewedBy: 'mod' });
        const counts = getFeedbackReviewStatusCounts({ guildId, window: 'all' });
        expect(counts.resolved).toBeGreaterThan(0);
    });

    it('system allows moderator', () => {
        const guildId = `health-mod-${Date.now()}`;
        seedHealthData(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.not_helpful');
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.ok).toBe(true);
    });

    it('system denies normal user', () => {
        const guildId = `health-deny-${Date.now()}`;
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: false }), { window: '7d' });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('permission-denied');
    });

    it('system renders empty dashboard', () => {
        const guildId = `health-empty-${Date.now()}`;
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.ok).toBe(true);
        expect(result.summary.askResponsesCount).toBe(0);
    });

    it('window filtering 24h/7d works', () => {
        const guildId = `health-window-${Date.now()}`;
        seedHealthData(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.helpful', 'low');
        const stats24h = getKnowledgeHealthStats({ guildId, window: '24h' });
        const stats7d = getKnowledgeHealthStats({ guildId, window: '7d' });
        expect(stats24h.askResponsesCount).toBeGreaterThanOrEqual(0);
        expect(stats7d.askResponsesCount).toBeGreaterThanOrEqual(stats24h.askResponsesCount);
    });

    it('command definition contains health subcommand', () => {
        const json = knowledgeCommand.data.toJSON();
        const names = (json.options || []).map(o => o.name);
        expect(names).toContain('health');
    });

    it('trend for 7d with previous window exists', () => {
        const guildId = `health-trend-${Date.now()}`;
        seedFeedbackBatch({ guildId, dayOffset: 2, responses: 6, helpful: 3, notHelpful: 1, outdated: 2 });
        seedFeedbackBatch({ guildId, dayOffset: 9, responses: 6, helpful: 2, notHelpful: 2, outdated: 2 });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.ok).toBe(true);
        expect(result.trends.askResponsesCount).not.toContain('n/a');
    });

    it('ratio-trend at low volume shows n/a', () => {
        const guildId = `health-ratio-low-${Date.now()}`;
        seedFeedbackBatch({ guildId, dayOffset: 2, responses: 2, helpful: 1 });
        seedFeedbackBatch({ guildId, dayOffset: 9, responses: 2, notHelpful: 1 });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.trends.helpfulRatio).toBe('n/a (low volume)');
    });

    it('helpful ratio improves at enough volume', () => {
        const guildId = `health-helpful-up-${Date.now()}`;
        seedFeedbackBatch({ guildId, dayOffset: 2, responses: 8, helpful: 6, notHelpful: 1, outdated: 1 });
        seedFeedbackBatch({ guildId, dayOffset: 9, responses: 8, helpful: 2, notHelpful: 4, outdated: 2 });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.trends.helpfulRatio.startsWith('↑')).toBe(true);
    });

    it('not helpful ratio worsens at enough volume', () => {
        const guildId = `health-notdown-${Date.now()}`;
        seedFeedbackBatch({ guildId, dayOffset: 2, responses: 8, helpful: 1, notHelpful: 6, outdated: 1 });
        seedFeedbackBatch({ guildId, dayOffset: 9, responses: 8, helpful: 4, notHelpful: 2, outdated: 2 });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.trends.notHelpfulRatio.startsWith('↓')).toBe(true);
    });

    it('ask-response trend at low volume is n/a', () => {
        const guildId = `health-ask-low-${Date.now()}`;
        seedFeedbackBatch({ guildId, dayOffset: 2, responses: 2, helpful: 1 });
        seedFeedbackBatch({ guildId, dayOffset: 9, responses: 1, helpful: 1 });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.trends.askResponsesCount).toBe('n/a (low volume)');
    });

    it('open-feedback trend at low review volume is n/a', () => {
        const guildId = `health-open-low-${Date.now()}`;
        upsertFeedbackReview({
            guildId,
            askContextId: `ctx${Date.now().toString(36).slice(-8)}`,
            feedbackType: 'ask.feedback.outdated',
            status: 'open',
            reviewedBy: 'mod',
            createdAt: daysAgoIso(2),
            updatedAt: daysAgoIso(2)
        });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.trends.openFeedbackCount).toBe('n/a (low volume)');
    });

    it('window=all shows trend unavailable', () => {
        const guildId = `health-all-na-${Date.now()}`;
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: 'all' });
        expect(result.trends.note).toContain('Trend unavailable');
        expect(result.trends.helpfulRatio).toBe('n/a');
    });

    it('empty previous period shows n/a instead of crash', () => {
        const guildId = `health-prev-na-${Date.now()}`;
        seedFeedbackBatch({ guildId, dayOffset: 2, responses: 1, helpful: 0, notHelpful: 0, outdated: 0 });
        const result = handleKnowledgeHealth(makeInteraction({ guildId, isModerator: true }), { window: '7d' });
        expect(result.trends.helpfulRatio).toContain('n/a');
        expect(result.trends.notHelpfulRatio).toContain('n/a');
        expect(result.trends.outdatedRatio).toContain('n/a');
    });
});

import { describe, it, expect } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';

const {
    addKnowledgeFeedbackEvent,
    upsertFeedbackReview,
    getFeedbackReview,
    aggregateKnowledgeFeedback,
    listKnowledgeEventsByType
} = knowledgeRepo;
const { handleKnowledgeFeedbackList, handleKnowledgeFeedbackReview } = knowledgeSystem;

function makeInteraction({ guildId, userId = 'mod-user', isModerator = true }) {
    return {
        guildId,
        channelId: 'c1',
        channel: { isThread: () => false },
        user: { id: userId },
        member: { permissions: { has: () => Boolean(isModerator) } }
    };
}

function seedFeedback(guildId, askContextId, feedbackEventType) {
    addKnowledgeFeedbackEvent({
        guildId,
        channelId: 'c1',
        askContextId,
        userId: 'ask-user',
        eventType: 'ask.response',
        details: { sourceEntryIds: [1], question: 'q' }
    });
    addKnowledgeFeedbackEvent({
        guildId,
        channelId: 'c1',
        askContextId,
        userId: 'u2',
        eventType: feedbackEventType,
        details: { sourceEntryIds: [1] }
    });
}

describe('knowledge feedback triage reviews', () => {
    it('upsertFeedbackReview creates review', () => {
        const guildId = `rev-create-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        const result = upsertFeedbackReview({
            guildId,
            askContextId,
            feedbackType: 'ask.feedback.outdated',
            status: 'reviewed',
            reviewedBy: 'mod-1',
            note: 'checked'
        });
        expect(result.changes).toBe(1);
        const row = getFeedbackReview(guildId, askContextId, 'ask.feedback.outdated');
        expect(row).toBeTruthy();
        expect(row.status).toBe('reviewed');
    });

    it('upsertFeedbackReview updates review', () => {
        const guildId = `rev-update-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        upsertFeedbackReview({
            guildId,
            askContextId,
            feedbackType: 'ask.feedback.not_helpful',
            status: 'reviewed',
            reviewedBy: 'mod-1'
        });
        upsertFeedbackReview({
            guildId,
            askContextId,
            feedbackType: 'ask.feedback.not_helpful',
            status: 'resolved',
            reviewedBy: 'mod-2',
            note: 'fixed'
        });
        const row = getFeedbackReview(guildId, askContextId, 'ask.feedback.not_helpful');
        expect(row.status).toBe('resolved');
        expect(row.reviewed_by).toBe('mod-2');
        expect(row.note).toBe('fixed');
    });

    it('feedback list default shows open', () => {
        const guildId = `rev-open-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedFeedback(guildId, askContextId, 'ask.feedback.outdated');
        const interaction = makeInteraction({ guildId, isModerator: true });
        const result = handleKnowledgeFeedbackList(interaction, { type: 'all', limit: 10 });
        expect(result.ok).toBe(true);
        expect(result.status).toBe('open');
    });

    it('feedback list status=all shows all', () => {
        const guildId = `rev-all-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedFeedback(guildId, askContextId, 'ask.feedback.helpful');
        upsertFeedbackReview({
            guildId,
            askContextId,
            feedbackType: 'ask.feedback.helpful',
            status: 'ignored',
            reviewedBy: 'mod'
        });
        const interaction = makeInteraction({ guildId, isModerator: true });
        const result = handleKnowledgeFeedbackList(interaction, { type: 'all', status: 'all', limit: 10 });
        expect(result.ok).toBe(true);
        expect(result.total).toBeGreaterThan(0);
    });

    it('review-feedback sets resolved', async () => {
        const guildId = `rev-set-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedFeedback(guildId, askContextId, 'ask.feedback.outdated');
        const interaction = makeInteraction({ guildId, userId: 'mod-x', isModerator: true });
        const result = await handleKnowledgeFeedbackReview(interaction, {
            askContextId,
            type: 'outdated',
            status: 'resolved',
            note: 'done'
        });
        expect(result.ok).toBe(true);
        const review = getFeedbackReview(guildId, askContextId, 'ask.feedback.outdated');
        expect(review.status).toBe('resolved');
    });

    it('review-feedback denied for normal user', async () => {
        const guildId = `rev-deny-${Date.now()}`;
        const interaction = makeInteraction({ guildId, userId: 'u', isModerator: false });
        const result = await handleKnowledgeFeedbackReview(interaction, {
            askContextId: 'ctxabcd12',
            type: 'helpful',
            status: 'reviewed'
        });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('permission-denied');
    });

    it('aggregation exposes review status', () => {
        const guildId = `rev-agg-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedFeedback(guildId, askContextId, 'ask.feedback.not_helpful');
        upsertFeedbackReview({
            guildId,
            askContextId,
            feedbackType: 'ask.feedback.not_helpful',
            status: 'reviewed',
            reviewedBy: 'mod'
        });
        const rows = aggregateKnowledgeFeedback({ guildId, type: 'all', status: 'all', limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].reviewStatus).toBeTruthy();
    });

    it('writes feedback.resolved lifecycle event', async () => {
        const guildId = `rev-event-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedFeedback(guildId, askContextId, 'ask.feedback.outdated');
        const interaction = makeInteraction({ guildId, userId: 'mod-z', isModerator: true });
        await handleKnowledgeFeedbackReview(interaction, {
            askContextId,
            type: 'outdated',
            status: 'resolved'
        });
        const events = listKnowledgeEventsByType(guildId, 'feedback.resolved', 10);
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].ask_context_id).toBe(askContextId);
    });
});

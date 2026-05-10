import { describe, it, expect } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';

const { addKnowledgeFeedbackEvent, listKnowledgeFeedback, createKnowledgeEntry } = knowledgeRepo;
const { handleKnowledgeFeedbackList } = knowledgeSystem;

function makeInteraction({ guildId, userId, isModerator }) {
    return {
        guildId,
        user: { id: userId || 'u1' },
        member: {
            permissions: {
                has() {
                    return Boolean(isModerator);
                }
            }
        }
    };
}

function seedFeedback(guildId, askContextId, eventType, sourceEntryIds = []) {
    addKnowledgeFeedbackEvent({
        guildId,
        channelId: 'c1',
        userId: 'u-seed',
        askContextId,
        eventType: 'ask.response',
        details: { sourceEntryIds, question: 'q' }
    });
    addKnowledgeFeedbackEvent({
        guildId,
        channelId: 'c1',
        userId: `u-${Math.random()}`,
        askContextId,
        eventType,
        details: { sourceEntryIds }
    });
}

describe('knowledge feedback moderation view', () => {
    it('repository lists outdated feedback', () => {
        const guildId = `fb-list-out-${Date.now()}`;
        seedFeedback(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.outdated');
        const rows = listKnowledgeFeedback({ guildId, type: 'outdated', limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.event_type === 'ask.feedback.outdated')).toBe(true);
    });

    it('repository lists not_helpful feedback', () => {
        const guildId = `fb-list-not-${Date.now()}`;
        seedFeedback(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.not_helpful');
        const rows = listKnowledgeFeedback({ guildId, type: 'not_helpful', limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.event_type === 'ask.feedback.not_helpful')).toBe(true);
    });

    it('repository lists all feedback', () => {
        const guildId = `fb-list-all-${Date.now()}`;
        seedFeedback(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.helpful');
        const rows = listKnowledgeFeedback({ guildId, type: 'all', limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
    });

    it('system allows moderator', () => {
        const guildId = `fb-mod-${Date.now()}`;
        const entryInsert = createKnowledgeEntry({
            guildId,
            channelId: 'c1',
            threadId: 't1',
            sourceMessageId: 'm1',
            sourceType: 'message',
            title: 'Sample source entry',
            content: 'Sample content',
            tags: 'sample',
            createdBy: 'u1',
            createdAt: new Date().toISOString()
        });
        const entryId = Number(entryInsert.lastInsertRowid);
        seedFeedback(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.outdated', [entryId]);
        const interaction = makeInteraction({ guildId, isModerator: true });
        const result = handleKnowledgeFeedbackList(interaction, { type: 'outdated', limit: 10 });
        expect(result.ok).toBe(true);
    });

    it('system denies normal user', () => {
        const guildId = `fb-deny-${Date.now()}`;
        const interaction = makeInteraction({ guildId, isModerator: false });
        const result = handleKnowledgeFeedbackList(interaction, { type: 'all', limit: 10 });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('permission-denied');
    });

    it('system returns empty response when no feedback', () => {
        const guildId = `fb-empty-${Date.now()}`;
        const interaction = makeInteraction({ guildId, isModerator: true });
        const result = handleKnowledgeFeedbackList(interaction, { type: 'all', limit: 10 });
        expect(result.ok).toBe(true);
        expect(result.code).toBe('empty');
    });

    it('grouped output contains KNW ids', () => {
        const guildId = `fb-knw-${Date.now()}`;
        const entryInsert = createKnowledgeEntry({
            guildId,
            channelId: 'c1',
            threadId: 't1',
            sourceMessageId: 'm1',
            sourceType: 'message',
            title: 'Another source entry',
            content: 'Another content',
            tags: 'sample',
            createdBy: 'u1',
            createdAt: new Date().toISOString()
        });
        const entryId = Number(entryInsert.lastInsertRowid);
        seedFeedback(guildId, `ctx${Date.now().toString(36).slice(-8)}`, 'ask.feedback.not_helpful', [entryId]);
        const interaction = makeInteraction({ guildId, isModerator: true });
        const result = handleKnowledgeFeedbackList(interaction, { type: 'all', limit: 10 });
        expect(result.ok).toBe(true);
        expect((result.lines || []).join('\n')).toContain('KNW-');
    });
});

import { describe, it, expect, vi } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';
import interactionEvent from '../src/events/interactionCreate.js';

const { addKnowledgeFeedbackEvent, hasUserFeedbackForAsk } = knowledgeRepo;
const { handleAskFeedbackInteraction } = knowledgeSystem;

function seedAskResponse(guildId, channelId, askContextId, sourceEntryIds = [1, 2]) {
    addKnowledgeFeedbackEvent({
        guildId,
        channelId,
        threadId: null,
        userId: 'ask-user',
        askContextId,
        eventType: 'ask.response',
        details: { sourceEntryIds, question: 'test?' }
    });
}

function makeButtonInteraction({ guildId, channelId, userId, customId }) {
    return {
        guildId,
        channelId,
        customId,
        user: { id: userId },
        message: { id: `msg-${Date.now()}` },
        channel: { isThread: () => false },
        isButton: () => true,
        isChatInputCommand: () => false,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,
        reply: vi.fn(async () => {})
    };
}

describe('ask feedback flow', () => {
    it('stores helpful feedback', async () => {
        const guildId = `fb-helpful-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedAskResponse(guildId, 'c1', askContextId);
        const interaction = makeButtonInteraction({
            guildId,
            channelId: 'c1',
            userId: 'u1',
            customId: `knowledge_feedback_helpful:${askContextId}`
        });
        const result = await handleAskFeedbackInteraction(interaction);
        expect(result.handled).toBe(true);
        expect(hasUserFeedbackForAsk(guildId, askContextId, 'u1', 'ask.feedback.helpful')).toBe(true);
    });

    it('is idempotent for duplicate feedback', async () => {
        const guildId = `fb-dupe-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedAskResponse(guildId, 'c1', askContextId);
        const interaction = makeButtonInteraction({
            guildId,
            channelId: 'c1',
            userId: 'u2',
            customId: `knowledge_feedback_helpful:${askContextId}`
        });
        const first = await handleAskFeedbackInteraction(interaction);
        const second = await handleAskFeedbackInteraction(interaction);
        expect(first.duplicate).toBe(false);
        expect(second.duplicate).toBe(true);
    });

    it('stores not helpful feedback', async () => {
        const guildId = `fb-not-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedAskResponse(guildId, 'c1', askContextId);
        const interaction = makeButtonInteraction({
            guildId,
            channelId: 'c1',
            userId: 'u3',
            customId: `knowledge_feedback_not_helpful:${askContextId}`
        });
        await handleAskFeedbackInteraction(interaction);
        expect(hasUserFeedbackForAsk(guildId, askContextId, 'u3', 'ask.feedback.not_helpful')).toBe(true);
    });

    it('stores outdated feedback', async () => {
        const guildId = `fb-out-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedAskResponse(guildId, 'c1', askContextId);
        const interaction = makeButtonInteraction({
            guildId,
            channelId: 'c1',
            userId: 'u4',
            customId: `knowledge_feedback_outdated:${askContextId}`
        });
        await handleAskFeedbackInteraction(interaction);
        expect(hasUserFeedbackForAsk(guildId, askContextId, 'u4', 'ask.feedback.outdated')).toBe(true);
    });

    it('handles invalid customId gracefully', async () => {
        const interaction = makeButtonInteraction({
            guildId: 'g-invalid',
            channelId: 'c1',
            userId: 'u5',
            customId: 'knowledge_feedback_unknown:bad'
        });
        const result = await handleAskFeedbackInteraction(interaction);
        expect(result.handled).toBe(true);
        expect(interaction.reply).toHaveBeenCalled();
    });

    it('routes feedback button through interactionCreate', async () => {
        const guildId = `fb-route-${Date.now()}`;
        const askContextId = `ctx${Date.now().toString(36).slice(-8)}`;
        seedAskResponse(guildId, 'c1', askContextId);
        const interaction = makeButtonInteraction({
            guildId,
            channelId: 'c1',
            userId: 'u6',
            customId: `knowledge_feedback_helpful:${askContextId}`
        });
        await interactionEvent.execute(interaction, {});
        expect(interaction.reply).toHaveBeenCalled();
    });
});

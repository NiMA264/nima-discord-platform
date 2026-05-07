import { describe, it, expect } from 'vitest';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';

const { shouldIngestMessage, MIN_CONTENT_LENGTH } = knowledgeSystem;

function baseMessage(overrides = {}) {
    return {
        guildId: 'g1',
        author: { id: 'u1', bot: false },
        content: 'a'.repeat(MIN_CONTENT_LENGTH + 5),
        channel: { name: 'coding-general' },
        ...overrides
    };
}

const config = {
    ai: { triggerChannels: ['coding-general'] },
    channels: { channels: { codingGeneral: 'coding-general' } }
};

describe('knowledge ingestion filter', () => {
    it('accepts relevant channel content', () => {
        const result = shouldIngestMessage(baseMessage(), config);
        expect(result).toEqual({ ok: true, reason: 'accepted' });
    });

    it('rejects bot messages', () => {
        const result = shouldIngestMessage(baseMessage({ author: { id: 'b1', bot: true } }), config);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('bot-message');
    });

    it('rejects short messages', () => {
        const result = shouldIngestMessage(baseMessage({ content: 'zu kurz' }), config);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('low-value-content');
    });
});

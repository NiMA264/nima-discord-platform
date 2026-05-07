import { describe, it, expect } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';

const { createKnowledgeEntry, searchKnowledgeEntries } = knowledgeRepo;

describe('knowledge retrieval', () => {
    it('returns relevant entries for query', () => {
        const marker = `mvp-${Date.now()}`;
        createKnowledgeEntry({
            guildId: 'test-guild',
            channelId: 'test-channel',
            threadId: 'test-thread',
            sourceMessageId: `msg-${marker}`,
            sourceType: 'message',
            title: `Routing issue ${marker}`,
            content: `The fix was to add a guard in interactionCreate for ${marker}.`,
            tags: 'discord,routing',
            createdBy: 'tester',
            createdAt: new Date().toISOString()
        });

        const rows = searchKnowledgeEntries('test-guild', marker, 5);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].content).toContain(marker);
    });
});

import { describe, it, expect } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';

const {
    createKnowledgeEntry,
    searchKnowledgeEntries,
    searchKnowledgeEntriesRanked,
    isFtsAvailable
} = knowledgeRepo;

const { askFromKnowledge } = knowledgeSystem;

describe('knowledge retrieval', () => {
    it('returns relevant entries for query', () => {
        const marker = `mvp-${Date.now()}`;
        createKnowledgeEntry({
            guildId: 'test-guild-basic',
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

        const rows = searchKnowledgeEntries('test-guild-basic', marker, 5);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].content).toContain(marker);
    });

    it('uses FTS path when available', () => {
        const marker = `fts-${Date.now()}`;
        createKnowledgeEntry({
            guildId: 'test-guild-fts',
            channelId: 'c',
            threadId: 't',
            sourceMessageId: `msg-${marker}`,
            sourceType: 'message',
            title: `Unhandled Promise ${marker}`,
            content: `Unhandled promise rejection appears with ${marker}.`,
            tags: 'node,error',
            createdBy: 'tester',
            createdAt: new Date().toISOString()
        });

        const result = searchKnowledgeEntriesRanked('test-guild-fts', marker, 5);
        if (isFtsAvailable()) {
            expect(result.mode).toBe('fts');
        } else {
            expect(result.mode).toBe('like');
        }
        expect(result.rows.length).toBeGreaterThan(0);
    });

    it('supports forced LIKE fallback search', () => {
        const marker = `fallback-${Date.now()}`;
        createKnowledgeEntry({
            guildId: 'test-guild-like',
            channelId: 'c',
            threadId: 't',
            sourceMessageId: `msg-${marker}`,
            sourceType: 'message',
            title: `Fallback ${marker}`,
            content: `Fallback retrieval test ${marker}`,
            tags: 'fallback',
            createdBy: 'tester',
            createdAt: new Date().toISOString()
        });

        const result = searchKnowledgeEntriesRanked('test-guild-like', marker, 5, { forceLike: true });
        expect(result.mode).toBe('like');
        expect(result.rows.length).toBeGreaterThan(0);
    });

    it('ranks accepted solutions higher', () => {
        const marker = `accepted-${Date.now()}`;
        createKnowledgeEntry({
            guildId: 'test-guild-accepted',
            channelId: 'c',
            threadId: 't',
            sourceMessageId: `msg-a-${marker}`,
            sourceType: 'message',
            title: `Solution ${marker}`,
            content: `This is one answer for ${marker}.`,
            tags: 'solution',
            isAcceptedSolution: true,
            acceptedBy: 'mod-1',
            acceptedAt: new Date().toISOString(),
            createdBy: 'tester',
            createdAt: new Date().toISOString()
        });
        createKnowledgeEntry({
            guildId: 'test-guild-accepted',
            channelId: 'c',
            threadId: 't',
            sourceMessageId: `msg-b-${marker}`,
            sourceType: 'message',
            title: `Alternative ${marker}`,
            content: `This is one answer for ${marker}.`,
            tags: 'solution',
            createdBy: 'tester',
            createdAt: new Date().toISOString()
        });

        const result = searchKnowledgeEntriesRanked('test-guild-accepted', marker, 5, { forceLike: true });
        expect(result.rows.length).toBeGreaterThan(1);
        expect(result.rows[0].is_accepted_solution).toBe(1);
        expect(result.rows[0].retrieval_score).toBeGreaterThanOrEqual(result.rows[1].retrieval_score);
    });

    it('returns low-confidence no-result behaviour for /ask', async () => {
        const cfg = {
            ai: { enabled: false, model: 'gpt-4.1-mini' }
        };
        const result = await askFromKnowledge(cfg, 'test-guild-empty', `absent-${Date.now()}`, 5);
        expect(result.confidence).toBe('low');
        expect(result.sources).toEqual([]);
        expect(result.answer.toLowerCase()).toMatch(/keine verl(ae|ä)sslichen treffer/);
    });
});

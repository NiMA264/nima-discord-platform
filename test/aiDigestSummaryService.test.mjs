import { describe, expect, it, vi } from 'vitest';

const aiDigestSummaryServiceModule = await import('../src/services/aiDigestSummaryService.js');
const aiDigestSummaryService = aiDigestSummaryServiceModule.default || aiDigestSummaryServiceModule;

describe('aiDigestSummaryService', () => {
    const digest = {
        workspaceId: 'ws-1',
        totalSuggestions: 3,
        bySeverity: [{ key: 'medium', count: 2 }],
        byType: [{ key: 'stale_in_progress_task', count: 3 }]
    };

    it('returns no-op without OPENAI_API_KEY', async () => {
        const previous = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        const result = await aiDigestSummaryService.generateAiDigestSummary(digest, {
            adapter: vi.fn(async () => 'should-not-be-used')
        });

        process.env.OPENAI_API_KEY = previous;
        expect(result.usedAi).toBe(false);
        expect(result.text).toBeNull();
    });

    it('uses adapter when OPENAI_API_KEY exists', async () => {
        const previous = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = 'test-key';

        const adapter = vi.fn(async () => '2 stale tasks and 1 overloaded assignee require attention this week.');
        const result = await aiDigestSummaryService.generateAiDigestSummary(digest, { adapter });

        process.env.OPENAI_API_KEY = previous;
        expect(result.usedAi).toBe(true);
        expect(result.text).toContain('stale tasks');
        expect(adapter).toHaveBeenCalledTimes(1);
    });
});

import { describe, it, expect } from 'vitest';

const { deterministicSummary, buildNormalizedContext } = await import('../src/services/aiProjectSummaryService.js');

describe('aiProjectSummaryService', () => {
    it('builds deterministic summary from normalized context', () => {
        const context = buildNormalizedContext({
            project: { project_uid: 'p1', name: 'P1', status: 'active' },
            counts: { logs: 2, tasks: 3, sprints: 1 },
            feed: [
                { timestamp: '2026-01-01T00:00:00Z', source: 'github', type: 'github.push', summary: 'push event' }
            ]
        }, 10);

        const text = deterministicSummary(context);
        expect(text).toContain('Project Summary: P1 (p1)');
        expect(text).toContain('activity: logs=2, tasks=3, sprints=1');
        expect(text).toContain('github.push');
    });
});

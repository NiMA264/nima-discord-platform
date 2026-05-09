import { describe, it, expect } from 'vitest';

const {
    deterministicSummary,
    deterministicChangelog,
    buildNormalizedContext
} = await import('../src/services/aiProjectSummaryService.js');

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

    it('builds deterministic changelog from normalized context', () => {
        const context = buildNormalizedContext({
            project: { project_uid: 'p2', name: 'P2', status: 'active' },
            counts: { logs: 1, tasks: 1, sprints: 0 },
            feed: [
                { timestamp: '2026-01-02T00:00:00Z', source: 'task', type: 'task.done', summary: 'Task closed' }
            ]
        }, 10);

        const text = deterministicChangelog(context);
        expect(text).toContain('Changelog: P2 (p2)');
        expect(text).toContain('task.done');
    });
});

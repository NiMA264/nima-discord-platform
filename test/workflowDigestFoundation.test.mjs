import { beforeEach, describe, expect, it, vi } from 'vitest';

const workflowDigestServiceModule = await import('../src/services/workflowDigestService.js');
const workflowDigestWorkerModule = await import('../src/workers/workflowDigestWorker.js');

const workflowDigestService = workflowDigestServiceModule.default || workflowDigestServiceModule;
const workflowDigestWorker = workflowDigestWorkerModule.default || workflowDigestWorkerModule;

describe('workflow digest foundation', () => {
    beforeEach(() => {
        workflowDigestWorker.resetWorkflowDigestWorkerState();
    });

    it('builds digest summary grouped by type and severity', () => {
        const digest = workflowDigestService.buildWorkspaceDigest({
            workspaceId: 'ws-b',
            suggestions: [
                { type: 'stale_in_progress_task', severity: 'medium' },
                { type: 'stale_in_progress_task', severity: 'high' },
                { type: 'inactive_project', severity: 'medium' }
            ]
        });

        expect(digest.workspaceId).toBe('ws-b');
        expect(digest.totalSuggestions).toBe(3);
        expect(digest.byType.find(item => item.key === 'stale_in_progress_task')?.count).toBe(2);
        expect(digest.bySeverity.find(item => item.key === 'medium')?.count).toBe(2);
    });

    it('runs once per day and logs non-empty workspace digests', async () => {
        const log = vi.fn();
        const getSuggestions = vi.fn(async ({ workspaceId }) => {
            if (workspaceId === 'ws-a') return { workspaceId, suggestions: [] };
            return {
                workspaceId,
                suggestions: [
                    { type: 'stale_in_progress_task', severity: 'medium', message: 'm1' },
                    { type: 'overloaded_assignee', severity: 'high', message: 'm2' }
                ]
            };
        });

        const first = await workflowDigestWorker.runWorkflowDigestCycleForGuild({ id: 'guild-b' }, {
            now: new Date('2026-05-12T08:00:00.000Z'),
            resolveWorkspaces: () => ['ws-a', 'ws-b'],
            getSuggestions,
            log
        });
        const second = await workflowDigestWorker.runWorkflowDigestCycleForGuild({ id: 'guild-b' }, {
            now: new Date('2026-05-12T20:00:00.000Z'),
            resolveWorkspaces: () => ['ws-a', 'ws-b'],
            getSuggestions,
            log
        });

        expect(first).toBe(1);
        expect(second).toBe(0);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0][0]).toContain('workspace=ws-b');
        expect(log.mock.calls[0][0]).toContain('totalSuggestions=2');
    });
});

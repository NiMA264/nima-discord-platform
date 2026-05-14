import { beforeEach, describe, expect, it } from 'vitest';
import { drainQueue, eventually } from './helpers/queueDrain.mjs';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase, getDatabase } = await import('../src/database/database.js');
const { createProjectEntity, listProjectLogs } = await import('../src/repositories/projectRepository.js');
const workerModule = await import('../src/workers/githubEventWorker.js');
const queueAdapterModule = await import('../src/queues/dbQueueAdapter.js');

const { processGithubEventsBatch } = workerModule.default || workerModule;
const queueAdapter = queueAdapterModule.default || queueAdapterModule;

initializeDatabase();

function queueState() {
    const db = getDatabase();
    const row = db.prepare(`
        SELECT
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queuedCount,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processingCount,
            SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) AS processedCount,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount
        FROM github_webhook_events
    `).get();
    return {
        queuedCount: Number(row?.queuedCount || 0),
        processingCount: Number(row?.processingCount || 0),
        processedCount: Number(row?.processedCount || 0),
        failedCount: Number(row?.failedCount || 0)
    };
}

describe('githubEventWorker queue drain helpers', () => {
    beforeEach(() => {
        const db = getDatabase();
        db.prepare('DELETE FROM github_webhook_events').run();
    });

    it('drains github queue deterministically and reaches idle state', async () => {
        const projectUid = 'project-drain-1';
        await createProjectEntity({
            projectUid,
            workspaceId: 'default-workspace',
            guildId: 'guild-drain-1',
            threadId: 'pending',
            creatorId: 'u-drain',
            name: 'Drain Project',
            slug: 'drain-project-1',
            description: 'drain test',
            stack: 'node',
            status: 'active'
        });

        queueAdapter.enqueue('github_events', {
            activity: {
                projectId: projectUid,
                type: 'push',
                summary: 'push received',
                url: 'https://github.com/org/repo/compare/main',
                actor: 'octocat',
                occurredAt: '2026-05-14T10:00:00.000Z'
            }
        }, {
            projectId: projectUid,
            eventName: 'push',
            deliveryId: 'delivery-drain-1',
            createdAt: '2026-05-14T10:00:00.000Z'
        });

        const result = await drainQueue({
            processBatch: (batchSize) => processGithubEventsBatch(batchSize),
            isIdle: () => {
                const state = queueState();
                return state.queuedCount === 0 && state.processingCount === 0;
            },
            describeState: () => queueState()
        }, {
            timeoutMs: 3000,
            intervalMs: 20
        });

        expect(result.processedTotal).toBe(1);

        await eventually(async () => {
            const logs = await listProjectLogs(projectUid, 20);
            expect(logs.some(item => item.event_type === 'github.push')).toBe(true);
        }, {
            timeoutMs: 1500,
            intervalMs: 25,
            describeState: () => queueState()
        });

        const finalState = queueState();
        expect(finalState.queuedCount).toBe(0);
        expect(finalState.processingCount).toBe(0);
        expect(finalState.processedCount).toBe(1);
        expect(finalState.failedCount).toBe(0);
    });
});

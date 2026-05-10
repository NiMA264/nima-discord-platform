import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { createProjectEntity, createProjectLog } = await import('../src/repositories/projectRepository.js');
const { createTaskEntity, closeTask } = await import('../src/repositories/taskRepository.js');
const { createSprintEntity } = await import('../src/repositories/sprintRepository.js');

const { runDigestCycleForGuild, resetDigestWorkerState } = await import('../src/workers/digestWorker.js');

initializeDatabase();

describe('digestWorker', () => {
    const emit = vi.fn(async () => {});

    beforeEach(() => {
        emit.mockClear();
        resetDigestWorkerState();
    });

    async function seedProject(guildId) {
        const projectUid = `digest-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        await createProjectEntity({
            projectUid,
            guildId,
            threadId: 'pending',
            creatorId: 'u1',
            name: 'Digest Project',
            slug: `digest-${Date.now()}`,
            description: 'digest test',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum-1',
            createdAt: new Date().toISOString()
        });

        const taskId = await createTaskEntity({
            projectUid,
            title: 'Digest Task',
            description: 'task for digest',
            createdBy: 'u1'
        });
        await closeTask(taskId);

        await createSprintEntity({ projectUid, title: 'Digest Sprint', startedBy: 'u1' });

        await createProjectLog({
            projectUid,
            source: 'SYSTEM',
            eventType: 'digest.seeded',
            content: { ok: true }
        });

        return projectUid;
    }

    it('emits daily digest', async () => {
        const guildId = `digest-guild-daily-${Date.now()}`;
        const projectUid = await seedProject(guildId);

        const emitted = await runDigestCycleForGuild({ id: guildId }, {
            config: {
                intervalMs: 60000,
                dailyHourUtc: 8,
                weeklyDayUtc: 1,
                weeklyHourUtc: 3,
                feedLimit: 20
            },
            now: new Date('2026-05-09T08:15:00.000Z'),
            emit
        });

        expect(emitted).toBe(1);
        expect(emit).toHaveBeenCalledWith('project.digest.daily', expect.objectContaining({
            projectId: projectUid,
            period: 'daily'
        }));
    }, 15000);

    it('emits weekly digest', async () => {
        const guildId = `digest-guild-weekly-${Date.now()}`;
        const projectUid = await seedProject(guildId);

        const emitted = await runDigestCycleForGuild({ id: guildId }, {
            config: {
                intervalMs: 60000,
                dailyHourUtc: 3,
                weeklyDayUtc: 6,
                weeklyHourUtc: 8,
                feedLimit: 20
            },
            now: new Date('2026-05-09T08:00:00.000Z'),
            emit
        });

        expect(emitted).toBe(1);
        expect(emit).toHaveBeenCalledWith('project.digest.weekly', expect.objectContaining({
            projectId: projectUid,
            period: 'weekly'
        }));
    }, 15000);
});

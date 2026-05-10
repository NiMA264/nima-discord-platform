import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { createProjectEntity, createProjectLog } = await import('../src/repositories/projectRepository.js');
const { createTask } = await import('../src/repositories/taskRepository.js');
const { createSprintEntity } = await import('../src/repositories/sprintRepository.js');
const { runInactivityCycleForGuild, resetInactivityWorkerState } = await import('../src/workers/inactivityDetectionWorker.js');

initializeDatabase();

function daysAgoIso(days) {
    return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

describe('inactivityDetectionWorker', () => {
    const emit = vi.fn(async () => {});

    beforeEach(() => {
        emit.mockClear();
        resetInactivityWorkerState();
    });

    async function seedInactiveProject(guildId) {
        const projectUid = `inactive-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        await createProjectEntity({
            projectUid,
            guildId,
            threadId: 'pending',
            creatorId: 'u1',
            name: 'Inactive Project',
            slug: `inactive-${Date.now()}`,
            description: 'inactive test',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum-1',
            createdAt: daysAgoIso(30)
        });

        await createProjectLog({
            projectUid,
            source: 'SYSTEM',
            eventType: 'project.seeded',
            content: { title: 'seed' },
            createdAt: daysAgoIso(12)
        });

        await createSprintEntity({
            projectUid,
            title: 'Old Active Sprint',
            startedBy: 'u1',
            startedAt: daysAgoIso(20),
            status: 'ACTIVE'
        });

        await createTask({
            taskUid: `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            projectUid,
            title: 'Unassigned Open Task',
            description: 'old open task',
            status: 'TODO',
            assignedTo: null,
            createdBy: 'u1',
            createdAt: daysAgoIso(8)
        });

        return projectUid;
    }

    it('emits project inactivity, stale sprint and unassigned open task signals', async () => {
        const guildId = `inactive-guild-${Date.now()}`;
        const projectUid = await seedInactiveProject(guildId);

        const emitted = await runInactivityCycleForGuild({ id: guildId }, {
            config: {
                intervalMs: 60000,
                feedLimit: 50,
                projectInactiveDays: 7,
                staleSprintDays: 14,
                unassignedTaskDays: 3,
                signalCooldownHours: 1
            },
            now: new Date(),
            emit
        });

        expect(emitted).toBe(3);
        expect(emit).toHaveBeenCalledWith('project.inactive.detected', expect.objectContaining({
            projectId: projectUid
        }));
        expect(emit).toHaveBeenCalledWith('sprint.stale.detected', expect.objectContaining({
            projectId: projectUid,
            staleCount: 1
        }));
        expect(emit).toHaveBeenCalledWith('task.unassigned_open.detected', expect.objectContaining({
            projectId: projectUid,
            openCount: 1
        }));
    });

    it('does not emit signals when thresholds are not crossed', async () => {
        const guildId = `active-guild-${Date.now()}`;
        const projectUid = `active-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        await createProjectEntity({
            projectUid,
            guildId,
            threadId: 'pending',
            creatorId: 'u1',
            name: 'Active Project',
            slug: `active-${Date.now()}`,
            description: 'active test',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum-1',
            createdAt: daysAgoIso(1)
        });

        await createProjectLog({
            projectUid,
            source: 'SYSTEM',
            eventType: 'project.recent',
            content: { title: 'recent' },
            createdAt: daysAgoIso(1)
        });

        const emitted = await runInactivityCycleForGuild({ id: guildId }, {
            config: {
                intervalMs: 60000,
                feedLimit: 50,
                projectInactiveDays: 7,
                staleSprintDays: 14,
                unassignedTaskDays: 3,
                signalCooldownHours: 1
            },
            now: new Date(),
            emit
        });

        expect(emitted).toBe(0);
        expect(emit).not.toHaveBeenCalled();
    });
});

import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const projectRepoModule = await import('../src/repositories/projectRepository.sqlite.js');
const taskRepoModule = await import('../src/repositories/taskRepository.sqlite.js');
const analyticsServiceModule = await import('../src/services/analyticsService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const projectRepo = projectRepoModule.default || projectRepoModule;
const taskRepo = taskRepoModule.default || taskRepoModule;
const analyticsService = analyticsServiceModule.default || analyticsServiceModule;

describe('analytics overview workspace scope', () => {
    it('aggregates KPIs from workspace-scoped repositories only', async () => {
        const guildId = `analytics-guild-${Date.now()}`;
        const wsA = workspaceService.createWorkspace({ name: `Analytics A ${Date.now()}`, ownerUserId: 'a' }).workspaceId;
        const wsB = workspaceService.createWorkspace({ name: `Analytics B ${Date.now()}`, ownerUserId: 'b' }).workspaceId;
        const projectA = `analytics-pa-${Date.now()}`;
        const projectB = `analytics-pb-${Date.now()}`;

        await projectRepo.createProjectEntity({
            projectUid: projectA,
            workspaceId: wsA,
            guildId,
            creatorId: 'a',
            name: 'Analytics A',
            slug: `analytics-a-${Date.now()}`,
            status: 'active'
        });
        await projectRepo.createProjectEntity({
            projectUid: projectB,
            workspaceId: wsB,
            guildId,
            creatorId: 'b',
            name: 'Analytics B',
            slug: `analytics-b-${Date.now()}`,
            status: 'active'
        });

        await taskRepo.createTask({
            taskUid: `task-open-${Date.now()}`,
            workspaceId: wsB,
            projectUid: projectB,
            title: 'Open Task',
            status: 'open',
            createdBy: 'b'
        });
        await taskRepo.createTask({
            taskUid: `task-progress-${Date.now()}`,
            workspaceId: wsB,
            projectUid: projectB,
            title: 'In Progress Task',
            status: 'in_progress',
            createdBy: 'b'
        });
        await taskRepo.createTask({
            taskUid: `task-done-${Date.now()}`,
            workspaceId: wsB,
            projectUid: projectB,
            title: 'Done Task',
            status: 'done',
            createdBy: 'b'
        });

        await projectRepo.createProjectLog({
            projectUid: projectB,
            workspaceId: wsB,
            source: 'SYSTEM',
            eventType: 'project.created',
            content: { summary: 'created b' }
        });
        await projectRepo.createProjectLog({
            projectUid: projectB,
            workspaceId: wsB,
            source: 'SYSTEM',
            eventType: 'task.created',
            content: { summary: 'task b' }
        });

        const result = await analyticsService.getAnalyticsOverview({
            guildId,
            workspaceId: wsB,
            userId: 'b'
        });

        expect(result.workspaceId).toBe(wsB);
        expect(result.activeProjects).toBe(1);
        expect(result.openTasks).toBe(1);
        expect(result.inProgressTasks).toBe(1);
        expect(result.completedTasks).toBe(1);
        expect(result.completionRate).toBeCloseTo(1 / 3, 4);
        expect(result.activityVolume).toBe(2);
    });
});

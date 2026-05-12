import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const projectRepoModule = await import('../src/repositories/projectRepository.sqlite.js');
const taskRepoModule = await import('../src/repositories/taskRepository.sqlite.js');
const domainEventServiceModule = await import('../src/domain/events/domainEventService.js');
const platformServiceClientModule = await import('../dashboard/src/lib/platformServiceClient.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const projectRepo = projectRepoModule.default || projectRepoModule;
const taskRepo = taskRepoModule.default || taskRepoModule;
const domainEventService = domainEventServiceModule.default || domainEventServiceModule;
const platformServiceClient = platformServiceClientModule.default || platformServiceClientModule;

describe('dashboard workspace flows', () => {
    it('supports non-default workspace list and detail without default-workspace fallback', async () => {
        const guildId = `guild-${Date.now()}`;
        const wsA = workspaceService.createWorkspace({ name: `WS-A-${Date.now()}`, ownerUserId: 'u-a' }).workspaceId;
        const wsB = workspaceService.createWorkspace({ name: `WS-B-${Date.now()}`, ownerUserId: 'u-b' }).workspaceId;
        const projectA = `project-a-${Date.now()}`;
        const projectB = `project-b-${Date.now()}`;

        await projectRepo.createProjectEntity({
            projectUid: projectA,
            workspaceId: wsA,
            guildId,
            creatorId: 'u-a',
            name: 'Project A',
            slug: `project-a-${Date.now()}`,
            status: 'active'
        });
        await projectRepo.createProjectEntity({
            projectUid: projectB,
            workspaceId: wsB,
            guildId,
            creatorId: 'u-b',
            name: 'Project B',
            slug: `project-b-${Date.now()}`,
            status: 'active'
        });
        await taskRepo.createTask({
            taskUid: `task-b-${Date.now()}`,
            workspaceId: wsB,
            projectUid: projectB,
            title: 'Task B',
            createdBy: 'u-b'
        });

        const wsBProjects = await platformServiceClient.listProjectsForGuild(guildId, { workspaceId: wsB, userId: 'u-b' });
        expect(wsBProjects.some(item => item.project_uid === projectB)).toBe(true);
        expect(wsBProjects.some(item => item.project_uid === projectA)).toBe(false);

        const detailB = await platformServiceClient.getProjectDashboardView(projectB, { workspaceId: wsB, guildId, userId: 'u-b' });
        expect(detailB).toBeTruthy();
        expect(detailB.project.project_uid).toBe(projectB);

        const detailWrongWorkspace = await platformServiceClient.getProjectDashboardView(projectB, { workspaceId: wsA, guildId, userId: 'u-a' });
        expect(detailWrongWorkspace).toBeNull();
    });

    it('returns workflow suggestions scoped to the requested workspace', async () => {
        const guildId = `guild-suggestions-${Date.now()}`;
        const wsA = workspaceService.createWorkspace({ name: `WS-SA-${Date.now()}`, ownerUserId: 'u-a' }).workspaceId;
        const wsB = workspaceService.createWorkspace({ name: `WS-SB-${Date.now()}`, ownerUserId: 'u-b' }).workspaceId;

        for (let i = 0; i < 6; i += 1) {
            domainEventService.recordDomainEvent({
                workspaceId: wsB,
                type: 'task.assigned',
                entityType: 'task',
                entityId: `task-b-${Date.now()}-${i}`,
                metadata: { projectId: 'project-b', assigneeUserId: 'discord-b' }
            });
        }

        domainEventService.recordDomainEvent({
            workspaceId: wsA,
            type: 'task.assigned',
            entityType: 'task',
            entityId: `task-a-${Date.now()}`,
            metadata: { projectId: 'project-a', assigneeUserId: 'discord-a' }
        });

        const suggestionsB = await platformServiceClient.getWorkflowSuggestionsForGuild(guildId, {
            workspaceId: wsB,
            userId: 'u-b'
        });

        expect(suggestionsB.workspaceId).toBe(wsB);
        expect(suggestionsB.suggestions.some(item => item.type === 'overloaded_assignee')).toBe(true);
        expect(suggestionsB.suggestions.every(item => item.entityId !== 'discord-a')).toBe(true);
    });
});

import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const projectRepoModule = await import('../src/repositories/projectRepository.sqlite.js');
const taskServiceModule = await import('../src/services/taskService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const projectRepo = projectRepoModule.default || projectRepoModule;
const taskService = taskServiceModule.default || taskServiceModule;

describe('task create workspace flow', () => {
    it('creates task only when lookup uses the correct explicit workspace', async () => {
        const guildId = `guild-${Date.now()}`;
        const wsA = workspaceService.createWorkspace({ name: `Task-WS-A-${Date.now()}`, ownerUserId: 'u-a' }).workspaceId;
        const wsB = workspaceService.createWorkspace({ name: `Task-WS-B-${Date.now()}`, ownerUserId: 'u-b' }).workspaceId;
        const projectB = `task-project-b-${Date.now()}`;

        await projectRepo.createProjectEntity({
            projectUid: projectB,
            workspaceId: wsB,
            guildId,
            creatorId: 'u-b',
            name: 'Task Project B',
            slug: `task-project-b-${Date.now()}`,
            status: 'active'
        });

        const wrongWorkspaceResult = await taskService.createTask({
            projectId: projectB,
            title: 'Should fail in wrong workspace',
            description: 'ws mismatch',
            actorId: 'u-a',
            workspaceId: wsA
        });
        expect(wrongWorkspaceResult).toBeNull();

        const createdTask = await taskService.createTask({
            projectId: projectB,
            title: 'Should pass in ws-b',
            description: 'ws match',
            actorId: 'u-b',
            workspaceId: wsB
        });
        expect(createdTask).toBeTruthy();
        expect(createdTask.project_uid).toBe(projectB);
        expect(createdTask.workspace_id).toBe(wsB);
    });
});

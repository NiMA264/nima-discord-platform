import { describe, it, expect } from 'vitest';
import projectRepo from '../src/repositories/projectRepository.sqlite.js';
import taskRepo from '../src/repositories/taskRepository.sqlite.js';

describe('workspace scoped core stores', () => {
    it('isolates project/task/activity rows by workspace', async () => {
        const guildId = `guild-${Date.now()}`;
        const wsA = `ws-a-${Date.now()}`;
        const wsB = `ws-b-${Date.now()}`;
        const projectA = `project-a-${Date.now()}`;
        const projectB = `project-b-${Date.now()}`;

        await projectRepo.createProjectEntity({ projectUid: projectA, workspaceId: wsA, guildId, creatorId: 'u1', name: 'Project A', slug: `project-a-${Date.now()}`, status: 'active' });
        await projectRepo.createProjectEntity({ projectUid: projectB, workspaceId: wsB, guildId, creatorId: 'u2', name: 'Project B', slug: `project-b-${Date.now()}`, status: 'active' });

        await projectRepo.createProjectLog({ projectUid: projectA, workspaceId: wsA, source: 'SYSTEM', eventType: 'project.created', content: { summary: 'A created' } });
        await projectRepo.createProjectLog({ projectUid: projectB, workspaceId: wsB, source: 'SYSTEM', eventType: 'project.created', content: { summary: 'B created' } });

        await taskRepo.createTask({ taskUid: `task-a-${Date.now()}`, workspaceId: wsA, projectUid: projectA, title: 'Task A', createdBy: 'u1' });
        await taskRepo.createTask({ taskUid: `task-b-${Date.now()}`, workspaceId: wsB, projectUid: projectB, title: 'Task B', createdBy: 'u2' });

        const projectsA = await projectRepo.listProjectsByGuild(guildId, { workspaceId: wsA });
        const projectsB = await projectRepo.listProjectsByGuild(guildId, { workspaceId: wsB });
        expect(projectsA.some(item => item.project_uid === projectA)).toBe(true);
        expect(projectsA.some(item => item.project_uid === projectB)).toBe(false);
        expect(projectsB.some(item => item.project_uid === projectB)).toBe(true);
        expect(projectsB.some(item => item.project_uid === projectA)).toBe(false);

        const logsAFromA = await projectRepo.listProjectLogs(projectA, 20, wsA);
        const logsAFromB = await projectRepo.listProjectLogs(projectA, 20, wsB);
        expect(logsAFromA.length).toBeGreaterThan(0);
        expect(logsAFromB.length).toBe(0);

        const tasksAFromA = await taskRepo.listTasksByProject(projectA, 20, wsA);
        const tasksAFromB = await taskRepo.listTasksByProject(projectA, 20, wsB);
        expect(tasksAFromA.length).toBeGreaterThan(0);
        expect(tasksAFromB.length).toBe(0);
    });
});

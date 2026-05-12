import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const projectServiceModule = await import('../src/services/projectService.js');
const taskServiceModule = await import('../src/services/taskService.js');
const domainEventRepositoryModule = await import('../src/repositories/domainEventRepository.js');

const projectService = projectServiceModule.default || projectServiceModule;
const taskService = taskServiceModule.default || taskServiceModule;
const domainEventRepository = domainEventRepositoryModule.default || domainEventRepositoryModule;

describe('domain event foundation', () => {
    it('records append-only facts for project/task flows', async () => {
        const workspaceId = String(process.env.DEFAULT_WORKSPACE_ID || 'default-workspace');

        const guildId = `events-guild-${Date.now()}`;
        const projectName = `Events Project ${Date.now()}`;
        const created = await projectService.createProject({
            workspaceId,
            guildId,
            creatorId: 'events-user',
            name: projectName,
            description: 'event foundation',
            stack: 'node',
            status: 'active',
            type: 'internal',
            forumChannelId: 'forum-events',
            createdAt: new Date().toISOString()
        });

        const task = await taskService.createTask({
            projectId: created.projectUid,
            title: 'Event task',
            description: 'created for events',
            actorId: 'events-user',
            workspaceId
        });
        expect(task).toBeTruthy();

        const closed = await taskService.closeTask({
            taskId: task.task_uid,
            actorId: 'events-user'
        });
        expect(closed).toBeTruthy();

        const logResult = await projectService.addProjectLog({
            guildId,
            projectName,
            entry: 'manual log entry',
            userId: 'events-user'
        });
        expect(logResult).toBeTruthy();

        const events = domainEventRepository.listDomainEventsByWorkspace(workspaceId, 5000);
        const matching = events.filter(item =>
            item.entityId === created.projectUid
            || item.entityId === task.task_uid
            || item.metadata?.projectId === created.projectUid
        );
        const eventTypes = matching.map(item => item.type);

        expect(eventTypes).toContain('project.created');
        expect(eventTypes).toContain('task.created');
        expect(eventTypes).toContain('task.status_changed');
        expect(eventTypes).toContain('project.log_added');
    });
});

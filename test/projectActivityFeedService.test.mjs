import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { ensurePhase1Persistence } = await import('../src/database/phase1PersistenceMigration.js');
const { createProjectEntity, createProjectLog } = await import('../src/repositories/projectRepository.js');
const { createTaskEntity } = await import('../src/repositories/taskRepository.js');
const { createSprintEntity } = await import('../src/repositories/sprintRepository.js');
const { getProjectActivityFeed } = await import('../src/services/projectActivityFeedService.js');

describe('projectActivityFeedService', () => {
    initializeDatabase();
    ensurePhase1Persistence();

    it('builds merged feed from logs/tasks/sprints', async () => {
        const projectId = `feed-${Date.now()}`;
        await createProjectEntity({
            projectUid: projectId,
            guildId: 'g-feed',
            threadId: 'pending',
            creatorId: 'u1',
            name: 'Feed Project',
            slug: `feed-project-${Date.now()}`,
            description: 'desc',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum',
            createdAt: new Date().toISOString()
        });

        await createProjectLog({
            projectUid: projectId,
            source: 'SYSTEM',
            eventType: 'project.test',
            content: { summary: 'project event' }
        });
        await createTaskEntity({ projectUid: projectId, title: 'Task A', description: '', createdBy: 'u1' });
        await createSprintEntity({ projectUid: projectId, title: 'Sprint A', startedBy: 'u1' });

        const result = await getProjectActivityFeed(projectId, { limit: 20 });
        expect(result).toBeTruthy();
        expect(result.counts.logs).toBeGreaterThan(0);
        expect(result.counts.tasks).toBeGreaterThan(0);
        expect(result.counts.sprints).toBeGreaterThan(0);
        expect(result.feed.length).toBeGreaterThan(0);
    });
});

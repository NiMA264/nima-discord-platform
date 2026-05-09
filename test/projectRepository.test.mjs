import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const repository = await import('../src/repositories/projectRepository.js');

const {
    createProjectEntity,
    findProjectByUid,
    upsertProjectMember,
    findProjectMemberRole,
    createProjectLog,
    archiveProject
} = repository;

describe('projectRepository base cases', () => {
    initializeDatabase();

    it('creates and reads a project entity', async () => {
        const projectUid = `test-${Date.now()}-a`;

        await createProjectEntity({
            projectUid,
            guildId: 'g1',
            threadId: 'pending',
            creatorId: 'u1',
            name: 'Repo Test Project',
            slug: `repo-test-${Date.now()}`,
            description: 'desc',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum-1',
            createdAt: new Date().toISOString()
        });

        const project = await findProjectByUid(projectUid);
        expect(project).toBeTruthy();
        expect(project.name).toBe('Repo Test Project');
    });

    it('upserts member role and archives project', async () => {
        const projectUid = `test-${Date.now()}-b`;

        await createProjectEntity({
            projectUid,
            guildId: 'g1',
            threadId: 'pending',
            creatorId: 'u1',
            name: 'Repo Member Test',
            slug: `repo-member-${Date.now()}`,
            description: 'desc',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum-1',
            createdAt: new Date().toISOString()
        });

        await upsertProjectMember({ projectUid, userId: 'u2', role: 'MAINTAINER' });
        const role = await findProjectMemberRole(projectUid, 'u2');
        expect(role).toBe('MAINTAINER');

        await createProjectLog({
            projectUid,
            source: 'SYSTEM',
            eventType: 'test.event',
            content: { ok: true }
        });

        await archiveProject(projectUid);
        const updated = await findProjectByUid(projectUid);
        expect(updated.status).toBe('archived');
    });
});

import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { createProjectEntity } = await import('../src/repositories/projectRepository.js');
const { runProjectReconciliation } = await import('../src/reconciliation/projectReconciliation.js');

function createGuildMock(project) {
    return {
        id: project.guildId,
        channels: {
            cache: new Map(),
            fetch: async (id) => {
                if (id === project.threadId) {
                    return { id, type: 11, name: project.threadName };
                }
                if (id === project.forumChannelId) {
                    return { id, type: 15, name: 'forum' };
                }
                return null;
            }
        }
    };
}

describe('project reconciliation', () => {
    initializeDatabase();

    it('reports missing resources and name drift', async () => {
        const uid = `recon-${Date.now()}`;
        await createProjectEntity({
            projectUid: uid,
            guildId: 'guild-recon',
            threadId: 'thread-recon',
            creatorId: 'u1',
            name: 'DB Name',
            slug: `db-name-${Date.now()}`,
            description: 'desc',
            stack: 'node',
            status: 'active',
            forumChannelId: 'forum-recon',
            createdAt: new Date().toISOString()
        });

        const guild = createGuildMock({
            guildId: 'guild-recon',
            forumChannelId: 'forum-recon',
            threadId: 'thread-recon',
            threadName: 'Discord Name'
        });

        const report = await runProjectReconciliation(guild);
        expect(report.scannedProjects).toBeGreaterThan(0);
        expect(report.issues.some(x => x.type === 'name_drift')).toBe(true);
    });
});

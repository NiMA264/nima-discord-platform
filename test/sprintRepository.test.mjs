import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { ensurePhase1Persistence } = await import('../src/database/phase1PersistenceMigration.js');
const { createSprintEntity, findSprintByUid, closeSprint } = await import('../src/repositories/sprintRepository.js');

describe('sprintRepository', () => {
    initializeDatabase();
    ensurePhase1Persistence();

    it('creates and closes a sprint scaffold', async () => {
        const sprintId = await createSprintEntity({
            projectUid: 'test-project',
            title: 'Sprint 1',
            startedBy: 'u1'
        });

        const sprint = await findSprintByUid(sprintId);
        expect(sprint).toBeTruthy();
        expect(sprint.status).toBe('ACTIVE');

        await closeSprint(sprintId, 'u2');
        const closed = await findSprintByUid(sprintId);
        expect(closed.status).toBe('CLOSED');
    });
});

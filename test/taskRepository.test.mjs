import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { ensurePhase1Persistence } = await import('../src/database/phase1PersistenceMigration.js');
const { createTaskEntity, findTaskByUid } = await import('../src/repositories/taskRepository.js');

describe('taskRepository', () => {
    initializeDatabase();
    ensurePhase1Persistence();

    it('creates and fetches a task', async () => {
        const taskId = await createTaskEntity({
            projectUid: 'test-project',
            title: 'Test task',
            description: 'desc',
            createdBy: 'u1'
        });

        const task = await findTaskByUid(taskId);
        expect(task).toBeTruthy();
        expect(task.title).toBe('Test task');
    });
});

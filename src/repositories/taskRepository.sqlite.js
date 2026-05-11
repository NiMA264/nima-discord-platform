const { getDatabase } = require('../database/database');
const { ensurePhase1Persistence } = require('../database/phase1PersistenceMigration');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

ensurePhase1Persistence();
const db = getDatabase();

const statements = {
    createTask: db.prepare(`
        INSERT INTO tasks (task_uid, workspace_id, project_uid, title, description, status, assigned_to, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    findByUid: db.prepare(`
        SELECT * FROM tasks WHERE task_uid = ? LIMIT 1
    `),
    listByProject: db.prepare(`
        SELECT * FROM tasks
        WHERE project_uid = ? AND workspace_id = ?
        ORDER BY created_at DESC LIMIT ?
    `),
    assignTask: db.prepare(`
        UPDATE tasks SET assigned_to = ? WHERE task_uid = ?
    `),
    closeTask: db.prepare(`
        UPDATE tasks SET status = 'DONE', closed_at = ? WHERE task_uid = ?
    `)
};

async function createTask(data) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: data.workspaceId });
    return statements.createTask.run(
        data.taskUid,
        workspaceId,
        data.projectUid,
        data.title,
        data.description || null,
        data.status || 'TODO',
        data.assignedTo || null,
        data.createdBy,
        data.createdAt || new Date().toISOString()
    );
}

async function findTaskByUid(taskUid) {
    return statements.findByUid.get(taskUid) || null;
}

async function listTasksByProject(projectUid, limit = 50, workspaceIdInput) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    return statements.listByProject.all(projectUid, workspaceId, limit);
}

async function assignTask(taskUid, assignedTo) {
    return statements.assignTask.run(assignedTo, taskUid);
}

async function closeTask(taskUid) {
    return statements.closeTask.run(new Date().toISOString(), taskUid);
}

module.exports = {
    createTask,
    findTaskByUid,
    listTasksByProject,
    assignTask,
    closeTask
};

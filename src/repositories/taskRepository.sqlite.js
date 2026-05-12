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
    updateTaskStatus: db.prepare(`
        UPDATE tasks SET status = ?, closed_at = ? WHERE task_uid = ?
    `),
    closeTask: db.prepare(`
        UPDATE tasks SET status = 'done', closed_at = ? WHERE task_uid = ?
    `)
};

function normalizeTaskStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'todo') return 'open';
    if (value === 'doing') return 'in_progress';
    if (value === 'done' || value === 'completed' || value === 'closed') return 'done';
    if (value === 'open' || value === 'in_progress') return value;
    return 'open';
}

async function createTask(data) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: data.workspaceId });
    return statements.createTask.run(
        data.taskUid,
        workspaceId,
        data.projectUid,
        data.title,
        data.description || null,
        normalizeTaskStatus(data.status || 'open'),
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

async function updateTaskStatus(taskUid, status) {
    const normalized = normalizeTaskStatus(status);
    const closedAt = normalized === 'done' ? new Date().toISOString() : null;
    return statements.updateTaskStatus.run(normalized, closedAt, taskUid);
}

async function closeTask(taskUid) {
    return updateTaskStatus(taskUid, 'done');
}

module.exports = {
    createTask,
    findTaskByUid,
    listTasksByProject,
    assignTask,
    updateTaskStatus,
    closeTask
};

const crypto = require('crypto');
const { getPrisma } = require('../lib/prisma');
const sqliteAdapter = require('./taskRepository.sqlite');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

function useFallback() {
    return process.env.PROJECT_REPO_ADAPTER === 'sqlite';
}

function rowOrNull(rows) {
    return rows.length ? rows[0] : null;
}

async function createTask(data) {
    if (useFallback()) return sqliteAdapter.createTask(data);
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: data.workspaceId });
    const prisma = getPrisma();
    return prisma.$executeRaw`
        INSERT INTO tasks (task_uid, workspace_id, project_uid, title, description, status, assigned_to, created_by, created_at)
        VALUES (${data.taskUid}, ${workspaceId}, ${data.projectUid}, ${data.title}, ${data.description || null}, ${data.status || 'TODO'}, ${data.assignedTo || null}, ${data.createdBy}, ${data.createdAt || new Date().toISOString()})
    `;
}

async function createTaskEntity({ projectUid, title, description, createdBy, workspaceId }) {
    const taskUid = crypto.randomUUID();
    await createTask({ taskUid, projectUid, title, description, createdBy, status: 'TODO', workspaceId });
    return taskUid;
}

async function findTaskByUid(taskUid) {
    if (useFallback()) return sqliteAdapter.findTaskByUid(taskUid);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`SELECT * FROM tasks WHERE task_uid = ${taskUid} LIMIT 1`;
    return rowOrNull(rows);
}

async function listTasksByProject(projectUid, limit = 50, workspaceIdInput) {
    if (useFallback()) return sqliteAdapter.listTasksByProject(projectUid, limit, workspaceIdInput);
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const prisma = getPrisma();
    return prisma.$queryRaw`
        SELECT * FROM tasks
        WHERE project_uid = ${projectUid} AND workspace_id = ${workspaceId}
        ORDER BY created_at DESC LIMIT ${limit}
    `;
}

async function assignTask(taskUid, assignedTo) {
    if (useFallback()) return sqliteAdapter.assignTask(taskUid, assignedTo);
    const prisma = getPrisma();
    return prisma.$executeRaw`UPDATE tasks SET assigned_to = ${assignedTo} WHERE task_uid = ${taskUid}`;
}

async function closeTask(taskUid) {
    if (useFallback()) return sqliteAdapter.closeTask(taskUid);
    const prisma = getPrisma();
    return prisma.$executeRaw`UPDATE tasks SET status = 'DONE', closed_at = ${new Date().toISOString()} WHERE task_uid = ${taskUid}`;
}

module.exports = {
    createTask,
    createTaskEntity,
    findTaskByUid,
    listTasksByProject,
    assignTask,
    closeTask
};

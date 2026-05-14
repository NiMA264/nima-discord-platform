const { getPrisma } = require('../lib/prisma');
const sqliteAdapter = require('./taskRepository.sqlite');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');
const { nowIso } = require('../lib/clock');
const { newUuid } = require('../lib/uuidProvider');

function useFallback() {
    return process.env.PROJECT_REPO_ADAPTER === 'sqlite';
}

function rowOrNull(rows) {
    return rows.length ? rows[0] : null;
}

function mapTaskRow(row) {
    if (!row) return null;
    const assigneeUserId = row.assigneeUserId || row.assignee_user_id || row.assigned_to || null;
    return {
        ...row,
        assigneeUserId
    };
}

function normalizeTaskStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'todo') return 'open';
    if (value === 'doing') return 'in_progress';
    if (value === 'done' || value === 'completed' || value === 'closed') return 'done';
    if (value === 'open' || value === 'in_progress') return value;
    return 'open';
}

async function createTask(data) {
    if (useFallback()) return sqliteAdapter.createTask(data);
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: data.workspaceId });
    const prisma = getPrisma();
    return prisma.$executeRaw`
        INSERT INTO tasks (task_uid, workspace_id, project_uid, title, description, status, assignee_user_id, assigned_to, created_by, created_at)
        VALUES (${data.taskUid}, ${workspaceId}, ${data.projectUid}, ${data.title}, ${data.description || null}, ${normalizeTaskStatus(data.status || 'open')}, ${data.assigneeUserId || data.assignedTo || null}, ${data.assignedTo || null}, ${data.createdBy}, ${data.createdAt || nowIso()})
    `;
}

async function createTaskEntity({ projectUid, title, description, createdBy, workspaceId }) {
    const taskUid = newUuid();
    await createTask({ taskUid, projectUid, title, description, createdBy, status: 'open', workspaceId });
    return taskUid;
}

async function findTaskByUid(taskUid) {
    if (useFallback()) return sqliteAdapter.findTaskByUid(taskUid);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT
            *,
            COALESCE(assignee_user_id, assigned_to) AS assigneeUserId
        FROM tasks
        WHERE task_uid = ${taskUid}
        LIMIT 1
    `;
    return mapTaskRow(rowOrNull(rows));
}

async function listTasksByProject(projectUid, limit = 50, workspaceIdInput) {
    if (useFallback()) return sqliteAdapter.listTasksByProject(projectUid, limit, workspaceIdInput);
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT
            *,
            COALESCE(assignee_user_id, assigned_to) AS assigneeUserId
        FROM tasks
        WHERE project_uid = ${projectUid} AND workspace_id = ${workspaceId}
        ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map(mapTaskRow);
}

async function assignTask(taskUid, assignedTo) {
    if (useFallback()) return sqliteAdapter.assignTask(taskUid, assignedTo);
    const prisma = getPrisma();
    return prisma.$executeRaw`
        UPDATE tasks
        SET assignee_user_id = ${assignedTo}, assigned_to = ${assignedTo}
        WHERE task_uid = ${taskUid}
    `;
}

async function updateTaskStatus(taskUid, status, workspaceIdInput) {
    if (useFallback()) return sqliteAdapter.updateTaskStatus(taskUid, status, workspaceIdInput);
    const normalized = normalizeTaskStatus(status);
    const closedAt = normalized === 'done' ? nowIso() : null;
    const prisma = getPrisma();
    if (!workspaceIdInput) {
        return prisma.$executeRaw`
            UPDATE tasks
            SET status = ${normalized}, closed_at = ${closedAt}
            WHERE task_uid = ${taskUid}
        `;
    }
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    return prisma.$executeRaw`
        UPDATE tasks
        SET status = ${normalized}, closed_at = ${closedAt}
        WHERE task_uid = ${taskUid} AND workspace_id = ${workspaceId}
    `;
}

async function closeTask(taskUid) {
    return updateTaskStatus(taskUid, 'done');
}

module.exports = {
    createTask,
    createTaskEntity,
    findTaskByUid,
    listTasksByProject,
    assignTask,
    updateTaskStatus,
    closeTask
};

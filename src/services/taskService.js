const {
    createTaskEntity,
    findTaskByUid,
    assignTask: assignTaskRepository,
    updateTaskStatus: updateTaskStatusRepository
} = require('../repositories/taskRepository');
const { createProjectLog, findProjectByUid } = require('../repositories/projectRepository');
const { notifyDomainEvent } = require('./notificationService');
const { recordDomainEvent } = require('../domain/events/domainEventService');

async function createTask({ projectId, title, description, actorId, workspaceId }) {
    const project = await findProjectByUid(projectId, workspaceId);
    if (!project) return null;

    const taskId = await createTaskEntity({
        projectUid: projectId,
        title,
        description,
        createdBy: actorId,
        workspaceId: project.workspace_id
    });

    await createProjectLog({
        projectUid: projectId,
        source: 'SYSTEM',
        eventType: 'task.created',
        content: { taskId, title, description, actorId },
        workspaceId: project.workspace_id
    });
    recordDomainEvent({
        workspaceId: project.workspace_id,
        type: 'task.created',
        entityType: 'task',
        entityId: taskId,
        metadata: {
            projectId,
            actorId
        }
    });

    return findTaskByUid(taskId);
}

async function assignTask({ taskId, assigneeUserId, userId, actorId, workspaceId }) {
    const task = await findTaskByUid(taskId);
    if (!task) return null;
    if (workspaceId && task.workspace_id !== workspaceId) return null;
    const nextAssigneeUserId = String(assigneeUserId || userId || '').trim();
    if (!nextAssigneeUserId) return null;

    await assignTaskRepository(taskId, nextAssigneeUserId);
    await createProjectLog({
        projectUid: task.project_uid,
        source: 'SYSTEM',
        eventType: 'task.assigned',
        content: {
            taskId,
            assigneeUserId: nextAssigneeUserId,
            actorId
        },
        workspaceId: task.workspace_id
    });
    recordDomainEvent({
        workspaceId: task.workspace_id,
        type: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        metadata: {
            projectId: task.project_uid,
            assigneeUserId: nextAssigneeUserId,
            actorId
        }
    });
    const updated = await findTaskByUid(taskId);

    await notifyDomainEvent('task.assigned', {
        projectId: task.project_uid,
        taskId: updated?.task_uid || taskId,
        taskTitle: updated?.title || task.title,
        assigneeUserId: nextAssigneeUserId,
        actorId
    });

    return updated;
}

async function closeTask({ taskId, actorId }) {
    return updateTaskStatus({ taskId, status: 'done', actorId });
}

async function updateTaskStatus({ taskId, status, actorId, workspaceId }) {
    const task = await findTaskByUid(taskId);
    if (!task) return null;
    if (workspaceId && task.workspace_id !== workspaceId) return null;

    const previousStatus = String(task.status || '').trim().toLowerCase();
    await updateTaskStatusRepository(taskId, status, task.workspace_id);
    await createProjectLog({
        projectUid: task.project_uid,
        source: 'SYSTEM',
        eventType: 'task.status_changed',
        content: {
            taskId,
            actorId,
            previousStatus,
            nextStatus: String(status || '').trim().toLowerCase()
        },
        workspaceId: task.workspace_id
    });
    recordDomainEvent({
        workspaceId: task.workspace_id,
        type: 'task.status_changed',
        entityType: 'task',
        entityId: taskId,
        metadata: {
            projectId: task.project_uid,
            previousStatus,
            nextStatus: String(status || '').trim().toLowerCase(),
            actorId
        }
    });

    const updated = await findTaskByUid(taskId);

    await notifyDomainEvent('task.status_changed', {
        projectId: task.project_uid,
        taskId: updated?.task_uid || taskId,
        taskTitle: updated?.title || task.title,
        previousStatus,
        nextStatus: updated?.status || String(status || '').trim().toLowerCase(),
        actorId
    });

    return updated;
}

module.exports = {
    createTask,
    assignTask,
    closeTask,
    updateTaskStatus
};

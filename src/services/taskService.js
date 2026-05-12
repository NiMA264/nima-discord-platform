const {
    createTaskEntity,
    findTaskByUid,
    assignTask: assignTaskRepository,
    closeTask: closeTaskRepository
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

async function assignTask({ taskId, userId, actorId }) {
    const task = await findTaskByUid(taskId);
    if (!task) return null;

    await assignTaskRepository(taskId, userId);
    await createProjectLog({
        projectUid: task.project_uid,
        source: 'SYSTEM',
        eventType: 'task.assigned',
        content: { taskId, userId, actorId },
        workspaceId: task.workspace_id
    });
    const updated = await findTaskByUid(taskId);

    await notifyDomainEvent('task.assigned', {
        projectId: task.project_uid,
        taskId: updated?.task_uid || taskId,
        taskTitle: updated?.title || task.title,
        assigneeUserId: userId,
        actorId
    });

    return updated;
}

async function closeTask({ taskId, actorId }) {
    const task = await findTaskByUid(taskId);
    if (!task) return null;

    await closeTaskRepository(taskId);
    await createProjectLog({
        projectUid: task.project_uid,
        source: 'SYSTEM',
        eventType: 'task.closed',
        content: { taskId, actorId },
        workspaceId: task.workspace_id
    });
    recordDomainEvent({
        workspaceId: task.workspace_id,
        type: 'task.completed',
        entityType: 'task',
        entityId: taskId,
        metadata: {
            projectId: task.project_uid,
            actorId
        }
    });

    const updated = await findTaskByUid(taskId);

    await notifyDomainEvent('task.closed', {
        projectId: task.project_uid,
        taskId: updated?.task_uid || taskId,
        taskTitle: updated?.title || task.title,
        actorId
    });

    return updated;
}

module.exports = {
    createTask,
    assignTask,
    closeTask
};

const {
    createTaskEntity,
    findTaskByUid,
    assignTask: assignTaskRepository,
    closeTask: closeTaskRepository
} = require('../repositories/taskRepository');
const { createProjectLog } = require('../repositories/projectRepository');
const { notifyDomainEvent } = require('./notificationService');

async function createTask({ projectId, title, description, actorId }) {
    const taskId = await createTaskEntity({
        projectUid: projectId,
        title,
        description,
        createdBy: actorId
    });

    await createProjectLog({
        projectUid: projectId,
        source: 'SYSTEM',
        eventType: 'task.created',
        content: { taskId, title, description, actorId }
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
        content: { taskId, userId, actorId }
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
        content: { taskId, actorId }
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

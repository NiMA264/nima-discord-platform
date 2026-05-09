const {
    createTaskEntity,
    findTaskByUid,
    assignTask: assignTaskRepository,
    closeTask: closeTaskRepository
} = require('../repositories/taskRepository');
const { createProjectLog } = require('../repositories/projectRepository');

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

    return findTaskByUid(taskId);
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

    return findTaskByUid(taskId);
}

module.exports = {
    createTask,
    assignTask,
    closeTask
};

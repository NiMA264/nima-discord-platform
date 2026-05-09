const { createSprintEntity, findSprintByUid, closeSprint: closeSprintRepository } = require('../repositories/sprintRepository');
const { createProjectLog } = require('../repositories/projectRepository');
const { notifyDomainEvent } = require('./notificationService');

async function startSprint({ projectId, title, actorId }) {
    const sprintId = await createSprintEntity({ projectUid: projectId, title, startedBy: actorId });

    await createProjectLog({
        projectUid: projectId,
        source: 'SYSTEM',
        eventType: 'sprint.started',
        content: { sprintId, title, actorId }
    });

    const sprint = await findSprintByUid(sprintId);

    await notifyDomainEvent('sprint.started', {
        projectId,
        sprintId,
        sprintTitle: sprint?.title || title,
        actorId
    });

    return sprint;
}

async function closeSprint({ sprintId, actorId }) {
    const sprint = await findSprintByUid(sprintId);
    if (!sprint) return null;

    await closeSprintRepository(sprintId, actorId);
    await createProjectLog({
        projectUid: sprint.project_uid,
        source: 'SYSTEM',
        eventType: 'sprint.closed',
        content: { sprintId, actorId }
    });

    const updated = await findSprintByUid(sprintId);

    await notifyDomainEvent('sprint.closed', {
        projectId: sprint.project_uid,
        sprintId,
        sprintTitle: updated?.title || sprint.title,
        actorId
    });

    return updated;
}

module.exports = {
    startSprint,
    closeSprint
};

const { createSprintEntity, findSprintByUid, closeSprint: closeSprintRepository } = require('../repositories/sprintRepository');
const { createProjectLog } = require('../repositories/projectRepository');

async function startSprint({ projectId, title, actorId }) {
    const sprintId = await createSprintEntity({ projectUid: projectId, title, startedBy: actorId });

    await createProjectLog({
        projectUid: projectId,
        source: 'SYSTEM',
        eventType: 'sprint.started',
        content: { sprintId, title, actorId }
    });

    return findSprintByUid(sprintId);
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

    return findSprintByUid(sprintId);
}

module.exports = {
    startSprint,
    closeSprint
};

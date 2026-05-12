const projectRepository = require('./projectRepository');
const taskRepository = require('./taskRepository');

const COMPLETED_TASK_STATUSES = new Set(['DONE', 'COMPLETED', 'CLOSED']);
const INACTIVE_PROJECT_STATUSES = new Set(['ARCHIVED', 'INACTIVE']);

function normalizeStatus(value) {
    return String(value || '').trim().toUpperCase();
}

function isActiveProject(project) {
    return !INACTIVE_PROJECT_STATUSES.has(normalizeStatus(project?.status));
}

function isCompletedTask(task) {
    return COMPLETED_TASK_STATUSES.has(normalizeStatus(task?.status));
}

async function getWorkspaceOverview({ guildId, workspaceId }) {
    if (!guildId || !workspaceId) {
        return {
            activeProjects: 0,
            openTasks: 0,
            completedTasks: 0,
            activityVolume: 0
        };
    }

    const projects = await projectRepository.listProjectsByGuild(guildId, { workspaceId });
    const activeProjects = projects.filter(isActiveProject).length;

    const taskRowsByProject = await Promise.all(
        projects.map(project => taskRepository.listTasksByProject(project.project_uid, 1000, workspaceId))
    );
    const projectLogsByProject = await Promise.all(
        projects.map(project => projectRepository.listProjectLogs(project.project_uid, 1000, workspaceId))
    );

    let completedTasks = 0;
    let totalTasks = 0;
    for (const taskRows of taskRowsByProject) {
        totalTasks += taskRows.length;
        completedTasks += taskRows.filter(isCompletedTask).length;
    }

    let activityVolume = 0;
    for (const logs of projectLogsByProject) {
        activityVolume += logs.length;
    }

    return {
        activeProjects,
        openTasks: totalTasks - completedTasks,
        completedTasks,
        activityVolume
    };
}

module.exports = {
    getWorkspaceOverview
};

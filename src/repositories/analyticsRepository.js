const projectRepository = require('./projectRepository');
const taskRepository = require('./taskRepository');

const OPEN_TASK_STATUSES = new Set(['OPEN', 'TODO']);
const IN_PROGRESS_TASK_STATUSES = new Set(['IN_PROGRESS', 'DOING']);
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

function isInProgressTask(task) {
    return IN_PROGRESS_TASK_STATUSES.has(normalizeStatus(task?.status));
}

function isOpenTask(task) {
    const status = normalizeStatus(task?.status);
    return OPEN_TASK_STATUSES.has(status) || (!isInProgressTask(task) && !isCompletedTask(task));
}

async function getWorkspaceOverview({ guildId, workspaceId }) {
    if (!guildId || !workspaceId) {
        return {
            activeProjects: 0,
            openTasks: 0,
            inProgressTasks: 0,
            completedTasks: 0,
            completionRate: 0,
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

    let openTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    for (const taskRows of taskRowsByProject) {
        openTasks += taskRows.filter(isOpenTask).length;
        inProgressTasks += taskRows.filter(isInProgressTask).length;
        completedTasks += taskRows.filter(isCompletedTask).length;
    }

    let activityVolume = 0;
    for (const logs of projectLogsByProject) {
        activityVolume += logs.length;
    }

    const totalTasks = openTasks + inProgressTasks + completedTasks;
    const completionRate = totalTasks ? Number((completedTasks / totalTasks).toFixed(4)) : 0;

    return {
        activeProjects,
        openTasks,
        inProgressTasks,
        completedTasks,
        completionRate,
        activityVolume
    };
}

module.exports = {
    getWorkspaceOverview
};

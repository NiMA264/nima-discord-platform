const path = require('path');

const projectRepository = require(path.resolve(__dirname, '../../../src/repositories/projectRepository'));
const taskRepository = require(path.resolve(__dirname, '../../../src/repositories/taskRepository'));
const sprintRepository = require(path.resolve(__dirname, '../../../src/repositories/sprintRepository'));
const activityService = require(path.resolve(__dirname, '../../../src/services/projectActivityFeedService'));

async function listProjectsForGuild(guildId) {
    if (!guildId) return [];
    return projectRepository.listProjectsByGuild(guildId);
}

async function getProjectDashboardView(projectId) {
    if (!projectId) return null;

    const activity = await activityService.getProjectActivityFeed(projectId, { limit: 25 });
    if (!activity) return null;

    const [tasks, sprints] = await Promise.all([
        taskRepository.listTasksByProject(projectId, 25),
        sprintRepository.listSprintsByProject(projectId, 25)
    ]);

    return {
        project: activity.project,
        counts: activity.counts,
        feed: activity.feed,
        tasks,
        sprints
    };
}

module.exports = {
    listProjectsForGuild,
    getProjectDashboardView
};

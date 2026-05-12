const analyticsRepository = require('../repositories/analyticsRepository');
const workspaceService = require('../domain/workspace/workspaceService');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

async function getAnalyticsOverview({ guildId, userId, workspaceId: explicitWorkspaceId }) {
    const workspaceId = resolveWorkspaceId({
        userId,
        explicitWorkspaceId,
        guildId
    });

    if (!workspaceService.getWorkspaceById(workspaceId)) {
        return {
            workspaceId,
            activeProjects: 0,
            openTasks: 0,
            inProgressTasks: 0,
            completedTasks: 0,
            completionRate: 0,
            activityVolume: 0
        };
    }

    const overview = await analyticsRepository.getWorkspaceOverview({ guildId, workspaceId });
    return {
        workspaceId,
        ...overview
    };
}

module.exports = {
    getAnalyticsOverview
};

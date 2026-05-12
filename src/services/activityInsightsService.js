const activityInsightsRepository = require('../repositories/activityInsightsRepository');
const workspaceService = require('../domain/workspace/workspaceService');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

async function getActivityInsights({ guildId, userId, workspaceId: explicitWorkspaceId }) {
    const workspaceId = resolveWorkspaceId({
        userId,
        explicitWorkspaceId,
        guildId
    });

    if (!workspaceService.getWorkspaceById(workspaceId)) {
        return {
            workspaceId,
            recentEvents: [],
            topActiveProjects: [],
            recentAssignments: [],
            recentStatusChanges: []
        };
    }

    const insights = activityInsightsRepository.getWorkspaceActivityInsights({ workspaceId });
    return {
        workspaceId,
        ...insights
    };
}

module.exports = {
    getActivityInsights
};

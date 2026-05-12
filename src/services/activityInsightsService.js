const activityInsightsRepository = require('../repositories/activityInsightsRepository');
const githubInsightsService = require('./githubInsightsService');
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
            recentStatusChanges: [],
            githubActivity: {
                activeRepositories: [],
                recentGithubEvents: [],
                contributionCounts: {
                    push: 0,
                    pullRequestsOpened: 0,
                    issuesOpened: 0
                }
            }
        };
    }

    const insights = activityInsightsRepository.getWorkspaceActivityInsights({ workspaceId });
    const githubActivity = await githubInsightsService.getGithubActivityInsights({
        guildId,
        userId,
        workspaceId
    });
    return {
        workspaceId,
        ...insights,
        githubActivity: {
            activeRepositories: githubActivity.activeRepositories,
            recentGithubEvents: githubActivity.recentGithubEvents,
            contributionCounts: githubActivity.contributionCounts
        }
    };
}

module.exports = {
    getActivityInsights
};

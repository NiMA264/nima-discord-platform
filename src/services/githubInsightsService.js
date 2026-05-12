const githubInsightsRepository = require('../repositories/githubInsightsRepository');
const workspaceService = require('../domain/workspace/workspaceService');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

async function getGithubActivityInsights({ guildId, userId, workspaceId: explicitWorkspaceId }) {
    const workspaceId = resolveWorkspaceId({
        userId,
        explicitWorkspaceId,
        guildId
    });

    if (!workspaceService.getWorkspaceById(workspaceId)) {
        return {
            workspaceId,
            activeRepositories: [],
            recentGithubEvents: [],
            contributionCounts: {
                push: 0,
                pullRequestsOpened: 0,
                issuesOpened: 0
            }
        };
    }

    return {
        workspaceId,
        ...githubInsightsRepository.getWorkspaceGithubInsights({ workspaceId })
    };
}

module.exports = {
    getGithubActivityInsights
};

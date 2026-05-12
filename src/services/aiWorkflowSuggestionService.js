const workflowSuggestionRepository = require('../repositories/workflowSuggestionRepository');
const analyticsService = require('./analyticsService');
const activityInsightsService = require('./activityInsightsService');
const workspaceService = require('../domain/workspace/workspaceService');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

function daysSince(timestamp) {
    if (!timestamp) return 0;
    return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function createSuggestion({ type, severity, entityId, message }) {
    return { type, severity, entityId, message };
}

async function getWorkflowSuggestions({ guildId, userId, workspaceId: explicitWorkspaceId }) {
    const workspaceId = resolveWorkspaceId({
        userId,
        explicitWorkspaceId,
        guildId
    });

    if (!workspaceService.getWorkspaceById(workspaceId)) {
        return { workspaceId, suggestions: [] };
    }

    const [analytics, insights] = await Promise.all([
        analyticsService.getAnalyticsOverview({ guildId, userId, workspaceId }),
        activityInsightsService.getActivityInsights({ guildId, userId, workspaceId })
    ]);
    const repoInput = workflowSuggestionRepository.getSuggestionInputs({ workspaceId });

    const suggestions = [];

    for (const statusChange of insights.recentStatusChanges) {
        if (String(statusChange.nextStatus || '').toLowerCase() !== 'in_progress') continue;
        const ageDays = daysSince(new Date(statusChange.createdAt).getTime());
        if (ageDays >= 14) {
            suggestions.push(createSuggestion({
                type: 'stale_in_progress_task',
                severity: ageDays >= 21 ? 'high' : 'medium',
                entityId: statusChange.taskId,
                message: `Task has been in progress for ${ageDays} days.`
            }));
        }
    }

    for (const [assigneeUserId, stats] of repoInput.byAssignee.entries()) {
        if (stats.recentAssignments >= 5) {
            suggestions.push(createSuggestion({
                type: 'overloaded_assignee',
                severity: stats.recentAssignments >= 8 ? 'high' : 'medium',
                entityId: assigneeUserId,
                message: `Assignee received ${stats.recentAssignments} tasks in the last 7 days.`
            }));
        }
    }

    for (const [projectId, stats] of repoInput.byProject.entries()) {
        const inactivityDays = daysSince(stats.lastEventAt);
        if (stats.totalEvents >= 3 && inactivityDays >= 14) {
            suggestions.push(createSuggestion({
                type: 'inactive_project',
                severity: inactivityDays >= 30 ? 'high' : 'medium',
                entityId: projectId,
                message: `Project has no recorded events for ${inactivityDays} days.`
            }));
        }
        if (stats.totalEvents >= 3 && !stats.hasProjectUpdate && inactivityDays >= 7) {
            suggestions.push(createSuggestion({
                type: 'missing_project_updates',
                severity: 'low',
                entityId: projectId,
                message: 'Project activity exists without project update logs in the recent period.'
            }));
        }
    }

    if (analytics.activityVolume >= 20 && analytics.completionRate <= 0.25) {
        suggestions.push(createSuggestion({
            type: 'high_activity_low_completion',
            severity: 'medium',
            entityId: workspaceId,
            message: `High activity (${analytics.activityVolume}) with low completion rate (${Math.round((analytics.completionRate || 0) * 100)}%).`
        }));
    }

    return {
        workspaceId,
        suggestions
    };
}

module.exports = {
    getWorkflowSuggestions
};

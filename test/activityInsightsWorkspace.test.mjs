import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const domainEventServiceModule = await import('../src/domain/events/domainEventService.js');
const activityInsightsServiceModule = await import('../src/services/activityInsightsService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const domainEventService = domainEventServiceModule.default || domainEventServiceModule;
const activityInsightsService = activityInsightsServiceModule.default || activityInsightsServiceModule;

describe('activity insights workspace scope', () => {
    it('builds read-models from domain events in the selected workspace only', async () => {
        const guildId = `insights-guild-${Date.now()}`;
        const wsA = workspaceService.createWorkspace({ name: `Insights A ${Date.now()}`, ownerUserId: 'a' }).workspaceId;
        const wsB = workspaceService.createWorkspace({ name: `Insights B ${Date.now()}`, ownerUserId: 'b' }).workspaceId;

        domainEventService.recordDomainEvent({
            workspaceId: wsA,
            type: 'task.assigned',
            entityType: 'task',
            entityId: `task-a-${Date.now()}`,
            metadata: {
                projectId: 'project-a',
                assigneeUserId: 'discord-a',
                actorId: 'actor-a'
            }
        });

        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'task.assigned',
            entityType: 'task',
            entityId: `task-b1-${Date.now()}`,
            metadata: {
                projectId: 'project-b',
                assigneeUserId: 'discord-b1',
                actorId: 'actor-b'
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'task.status_changed',
            entityType: 'task',
            entityId: `task-b2-${Date.now()}`,
            metadata: {
                projectId: 'project-b',
                previousStatus: 'open',
                nextStatus: 'in_progress',
                actorId: 'actor-b'
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'github.push',
            entityType: 'repository',
            entityId: 'org/repo-b',
            metadata: {
                repositoryFullName: 'org/repo-b',
                sender: 'dev-b',
                url: 'https://github.com/org/repo-b/compare/main'
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'github.pull_request.opened',
            entityType: 'repository',
            entityId: 'org/repo-b',
            metadata: {
                repositoryFullName: 'org/repo-b',
                sender: 'dev-b',
                pullRequestNumber: 12,
                url: 'https://github.com/org/repo-b/pull/12'
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsA,
            type: 'github.issue.opened',
            entityType: 'repository',
            entityId: 'org/repo-a',
            metadata: {
                repositoryFullName: 'org/repo-a',
                sender: 'dev-a',
                issueNumber: 21,
                url: 'https://github.com/org/repo-a/issues/21'
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'task.status_changed',
            entityType: 'task',
            entityId: `task-b3-${Date.now()}`,
            metadata: {
                projectId: 'project-b',
                previousStatus: 'in_progress',
                nextStatus: 'done',
                actorId: 'actor-b'
            }
        });

        const insights = await activityInsightsService.getActivityInsights({
            guildId,
            workspaceId: wsB,
            userId: 'user-b'
        });

        expect(insights.workspaceId).toBe(wsB);
        expect(insights.recentEvents.length).toBeGreaterThanOrEqual(3);
        expect(insights.topActiveProjects[0]?.projectId).toBe('project-b');
        expect(insights.recentAssignments.some(item => item.assigneeUserId === 'discord-b1')).toBe(true);
        expect(insights.recentAssignments.some(item => item.assigneeUserId === 'discord-a')).toBe(false);
        expect(insights.recentStatusChanges.length).toBeGreaterThanOrEqual(2);
        expect(insights.recentStatusChanges.every(item => item.projectId === 'project-b')).toBe(true);
        expect(insights.githubActivity.activeRepositories[0]?.repositoryFullName).toBe('org/repo-b');
        expect(insights.githubActivity.recentGithubEvents.some(item => item.repositoryFullName === 'org/repo-a')).toBe(false);
        expect(insights.githubActivity.contributionCounts.push).toBeGreaterThanOrEqual(1);
        expect(insights.githubActivity.contributionCounts.pullRequestsOpened).toBeGreaterThanOrEqual(1);
    });
});

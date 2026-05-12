import { describe, expect, it } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const domainEventServiceModule = await import('../src/domain/events/domainEventService.js');
const githubInsightsServiceModule = await import('../src/services/githubInsightsService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const domainEventService = domainEventServiceModule.default || domainEventServiceModule;
const githubInsightsService = githubInsightsServiceModule.default || githubInsightsServiceModule;

describe('github insights service', () => {
    it('derives github activity read models from workspace-scoped domain events', async () => {
        const guildId = `github-insights-${Date.now()}`;
        const ws = workspaceService.createWorkspace({ name: `GH-${Date.now()}`, ownerUserId: 'u-gh' }).workspaceId;

        domainEventService.recordDomainEvent({
            workspaceId: ws,
            type: 'github.push',
            entityType: 'repository',
            entityId: 'org/repo-c',
            metadata: { sender: 'dev-c', url: 'https://github.com/org/repo-c/compare/main' }
        });
        domainEventService.recordDomainEvent({
            workspaceId: ws,
            type: 'github.issue.opened',
            entityType: 'repository',
            entityId: 'org/repo-c',
            metadata: { sender: 'dev-c', issueNumber: 9 }
        });

        const result = await githubInsightsService.getGithubActivityInsights({
            guildId,
            workspaceId: ws,
            userId: 'u-gh'
        });

        expect(result.workspaceId).toBe(ws);
        expect(result.activeRepositories[0]?.repositoryFullName).toBe('org/repo-c');
        expect(result.contributionCounts.push).toBeGreaterThanOrEqual(1);
        expect(result.contributionCounts.issuesOpened).toBeGreaterThanOrEqual(1);
        expect(result.recentGithubEvents.length).toBeGreaterThanOrEqual(2);
    });
});

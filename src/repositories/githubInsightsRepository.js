const domainEventRepository = require('./domainEventRepository');

function safeDate(value) {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : 0;
}

function getWorkspaceGithubInsights({ workspaceId }) {
    const events = domainEventRepository
        .listDomainEventsByWorkspace(workspaceId, 2000)
        .filter(item => String(item.type || '').startsWith('github.'));

    const repoCounts = new Map();
    const contributionCounts = {
        push: 0,
        pullRequestsOpened: 0,
        issuesOpened: 0
    };

    for (const event of events) {
        const repo = String(event.entityId || event.metadata?.repositoryFullName || '').trim();
        if (repo) repoCounts.set(repo, (repoCounts.get(repo) || 0) + 1);

        if (event.type === 'github.push') contributionCounts.push += 1;
        if (event.type === 'github.pull_request.opened') contributionCounts.pullRequestsOpened += 1;
        if (event.type === 'github.issue.opened') contributionCounts.issuesOpened += 1;
    }

    const activeRepositories = Array.from(repoCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([repositoryFullName, eventCount]) => ({ repositoryFullName, eventCount }));

    const recentGithubEvents = events
        .sort((a, b) => safeDate(b.createdAt) - safeDate(a.createdAt))
        .slice(0, 20)
        .map(item => ({
            eventUid: item.eventUid,
            type: item.type,
            repositoryFullName: item.entityId || item.metadata?.repositoryFullName || '',
            actor: item.metadata?.sender || '',
            url: item.metadata?.url || '',
            createdAt: item.createdAt
        }));

    return {
        activeRepositories,
        recentGithubEvents,
        contributionCounts
    };
}

module.exports = {
    getWorkspaceGithubInsights
};

function toRepositoryName(event) {
    return String(event?.entityId || event?.metadata?.repositoryFullName || '').trim();
}

function applyGithubActivityProjection(state, event) {
    const current = state || {
        repositoryEventCounts: {},
        recentGithubEvents: []
    };

    const repositoryFullName = toRepositoryName(event);
    const nextRepositoryEventCounts = { ...current.repositoryEventCounts };

    if (repositoryFullName) {
        nextRepositoryEventCounts[repositoryFullName] = (nextRepositoryEventCounts[repositoryFullName] || 0) + 1;
    }

    const nextRecentEvents = [
        {
            eventUid: event?.eventUid || event?.eventId || '',
            type: String(event?.type || event?.eventType || ''),
            repositoryFullName,
            actor: String(event?.metadata?.sender || event?.payload?.sender || ''),
            url: String(event?.metadata?.url || event?.payload?.url || ''),
            createdAt: event?.createdAt || event?.occurredAt || ''
        },
        ...(Array.isArray(current.recentGithubEvents) ? current.recentGithubEvents : [])
    ].slice(0, 20);

    return {
        ...current,
        repositoryEventCounts: nextRepositoryEventCounts,
        recentGithubEvents: nextRecentEvents
    };
}

module.exports = {
    applyGithubActivityProjection
};

const domainEventRepository = require('./domainEventRepository');

function safeDate(value) {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : 0;
}

function recentEvents(events, limit = 20) {
    return events
        .slice(0, limit)
        .map(event => ({
            eventUid: event.eventUid,
            type: event.type,
            entityType: event.entityType,
            entityId: event.entityId,
            metadata: event.metadata || {},
            createdAt: event.createdAt
        }));
}

function topActiveProjects(events, limit = 5) {
    const counts = new Map();
    for (const event of events) {
        const projectId = event.metadata?.projectId || (event.entityType === 'project' ? event.entityId : '');
        if (!projectId) continue;
        const prev = counts.get(projectId) || 0;
        counts.set(projectId, prev + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([projectId, eventCount]) => ({ projectId, eventCount }));
}

function recentAssignments(events, limit = 20) {
    return events
        .filter(event => event.type === 'task.assigned')
        .sort((a, b) => safeDate(b.createdAt) - safeDate(a.createdAt))
        .slice(0, limit)
        .map(event => ({
            eventUid: event.eventUid,
            taskId: event.entityId,
            projectId: event.metadata?.projectId || '',
            assigneeUserId: event.metadata?.assigneeUserId || '',
            actorId: event.metadata?.actorId || '',
            createdAt: event.createdAt
        }));
}

function recentStatusChanges(events, limit = 20) {
    return events
        .filter(event => event.type === 'task.status_changed')
        .sort((a, b) => safeDate(b.createdAt) - safeDate(a.createdAt))
        .slice(0, limit)
        .map(event => ({
            eventUid: event.eventUid,
            taskId: event.entityId,
            projectId: event.metadata?.projectId || '',
            previousStatus: event.metadata?.previousStatus || '',
            nextStatus: event.metadata?.nextStatus || '',
            actorId: event.metadata?.actorId || '',
            createdAt: event.createdAt
        }));
}

function getWorkspaceActivityInsights({ workspaceId }) {
    const events = domainEventRepository.listDomainEventsByWorkspace(workspaceId, 1000);
    return {
        recentEvents: recentEvents(events, 20),
        topActiveProjects: topActiveProjects(events, 5),
        recentAssignments: recentAssignments(events, 20),
        recentStatusChanges: recentStatusChanges(events, 20)
    };
}

module.exports = {
    getWorkspaceActivityInsights
};

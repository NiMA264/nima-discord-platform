const domainEventRepository = require('./domainEventRepository');

function toTimestamp(value) {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : 0;
}

function getProjectId(event) {
    return event.metadata?.projectId || (event.entityType === 'project' ? event.entityId : '');
}

function getSuggestionInputs({ workspaceId }) {
    const events = domainEventRepository.listDomainEventsByWorkspace(workspaceId, 5000);
    const byProject = new Map();
    const byAssignee = new Map();
    const nowTs = Date.now();

    for (const event of events) {
        const ts = toTimestamp(event.createdAt);
        const projectId = getProjectId(event);
        if (projectId) {
            const current = byProject.get(projectId) || { lastEventAt: 0, totalEvents: 0, hasProjectUpdate: false };
            current.lastEventAt = Math.max(current.lastEventAt, ts);
            current.totalEvents += 1;
            if (event.type === 'project.log_added') current.hasProjectUpdate = true;
            byProject.set(projectId, current);
        }

        if (event.type === 'task.assigned' && event.metadata?.assigneeUserId) {
            const assignee = String(event.metadata.assigneeUserId);
            const current = byAssignee.get(assignee) || { recentAssignments: 0 };
            if (ts >= (nowTs - (7 * 24 * 60 * 60 * 1000))) {
                current.recentAssignments += 1;
            }
            byAssignee.set(assignee, current);
        }
    }

    return {
        events,
        byProject,
        byAssignee
    };
}

module.exports = {
    getSuggestionInputs
};

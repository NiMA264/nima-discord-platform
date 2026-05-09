const { findProjectByUid, listProjectLogs } = require('../repositories/projectRepository');
const { listTasksByProject } = require('../repositories/taskRepository');
const { listSprintsByProject } = require('../repositories/sprintRepository');

function normalizeLogEntry(log) {
    return {
        timestamp: log.created_at,
        source: String(log.source || '').toLowerCase(),
        type: log.event_type,
        summary: log.content?.summary
            || log.content?.title
            || log.content?.entry
            || log.event_type,
        details: log.content
    };
}

function normalizeTaskEntry(task) {
    return {
        timestamp: task.closed_at || task.created_at,
        source: 'task',
        type: `task.${String(task.status || '').toLowerCase()}`,
        summary: `${task.title} [${task.status}]`,
        details: {
            taskId: task.task_uid,
            assignedTo: task.assigned_to,
            status: task.status
        }
    };
}

function normalizeSprintEntry(sprint) {
    return {
        timestamp: sprint.closed_at || sprint.started_at,
        source: 'sprint',
        type: `sprint.${String(sprint.status || '').toLowerCase()}`,
        summary: `${sprint.title} [${sprint.status}]`,
        details: {
            sprintId: sprint.sprint_uid,
            status: sprint.status
        }
    };
}

async function getProjectActivityFeed(projectId, options = {}) {
    const limit = Number(options.limit || 30);
    const project = await findProjectByUid(projectId);
    if (!project) return null;

    const [logs, tasks, sprints] = await Promise.all([
        listProjectLogs(projectId, limit),
        listTasksByProject(projectId, limit),
        listSprintsByProject(projectId, Math.max(10, Math.floor(limit / 2)))
    ]);

    const feed = [
        ...logs.map(normalizeLogEntry),
        ...tasks.map(normalizeTaskEntry),
        ...sprints.map(normalizeSprintEntry)
    ]
        .filter(entry => entry.timestamp)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

    return {
        project,
        counts: {
            logs: logs.length,
            tasks: tasks.length,
            sprints: sprints.length,
            total: feed.length
        },
        feed
    };
}

module.exports = {
    getProjectActivityFeed
};

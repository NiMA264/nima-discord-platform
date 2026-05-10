const { loadInactivityConfig } = require('../config/inactivity');
const { listProjectsByGuild } = require('../repositories/projectRepository');
const { listTasksByProject } = require('../repositories/taskRepository');
const { listSprintsByProject } = require('../repositories/sprintRepository');
const { getProjectActivityFeed } = require('../services/projectActivityFeedService');
const { notifyDomainEvent } = require('../services/notificationService');
const { handleWorkerError } = require('../lib/handleWorkerError');
const metrics = require('../lib/metrics');

let timer;
const signalState = new Map();

function msFromDays(days) {
    return Math.max(1, Number(days)) * 24 * 60 * 60 * 1000;
}

function msFromHours(hours) {
    return Math.max(1, Number(hours)) * 60 * 60 * 1000;
}

function toTimestamp(value) {
    const ts = new Date(value || 0).getTime();
    return Number.isFinite(ts) ? ts : 0;
}

function latestActivityTimestamp(activity) {
    if (!activity?.feed?.length) return 0;
    return activity.feed.reduce((max, entry) => {
        const ts = toTimestamp(entry.timestamp);
        return ts > max ? ts : max;
    }, 0);
}

function findStaleActiveSprints(sprints, nowTs, staleMs) {
    return sprints
        .filter(s => String(s.status || '').toUpperCase() === 'ACTIVE')
        .filter(s => (nowTs - toTimestamp(s.started_at)) >= staleMs);
}

function findUnassignedOpenTasks(tasks, nowTs, staleMs) {
    return tasks
        .filter(t => String(t.status || '').toUpperCase() !== 'DONE')
        .filter(t => !t.assigned_to)
        .filter(t => (nowTs - toTimestamp(t.created_at)) >= staleMs);
}

function shouldEmit(signalKey, nowTs, cooldownMs) {
    const last = signalState.get(signalKey) || 0;
    if ((nowTs - last) < cooldownMs) return false;
    signalState.set(signalKey, nowTs);
    return true;
}

async function evaluateProjectSignals(project, now, config, emit) {
    const nowTs = now.getTime();
    const cooldownMs = msFromHours(config.signalCooldownHours);
    const [activity, tasks, sprints] = await Promise.all([
        getProjectActivityFeed(project.project_uid, { limit: config.feedLimit }),
        listTasksByProject(project.project_uid, config.feedLimit),
        listSprintsByProject(project.project_uid, config.feedLimit)
    ]);

    if (!activity) return 0;

    let emitted = 0;
    const projectInactiveMs = msFromDays(config.projectInactiveDays);
    const staleSprintMs = msFromDays(config.staleSprintDays);
    const unassignedTaskMs = msFromDays(config.unassignedTaskDays);

    const latestTs = latestActivityTimestamp(activity) || toTimestamp(project.created_at);
    const inactiveAgeMs = nowTs - latestTs;
    if (inactiveAgeMs >= projectInactiveMs) {
        const key = `${project.project_uid}:project.inactive`;
        if (shouldEmit(key, nowTs, cooldownMs)) {
            await emit('project.inactive.detected', {
                projectId: project.project_uid,
                guildId: project.guild_id,
                inactiveDays: Math.floor(inactiveAgeMs / (24 * 60 * 60 * 1000)),
                latestActivityAt: new Date(latestTs).toISOString(),
                occurredAt: now.toISOString()
            });
            emitted += 1;
        }
    }

    const staleSprints = findStaleActiveSprints(sprints, nowTs, staleSprintMs);
    if (staleSprints.length > 0) {
        const key = `${project.project_uid}:sprint.stale`;
        if (shouldEmit(key, nowTs, cooldownMs)) {
            await emit('sprint.stale.detected', {
                projectId: project.project_uid,
                guildId: project.guild_id,
                staleCount: staleSprints.length,
                staleSprints: staleSprints.slice(0, 5).map(s => ({
                    sprintId: s.sprint_uid,
                    title: s.title,
                    startedAt: s.started_at
                })),
                occurredAt: now.toISOString()
            });
            emitted += 1;
        }
    }

    const unassignedTasks = findUnassignedOpenTasks(tasks, nowTs, unassignedTaskMs);
    if (unassignedTasks.length > 0) {
        const key = `${project.project_uid}:task.unassigned_open`;
        if (shouldEmit(key, nowTs, cooldownMs)) {
            await emit('task.unassigned_open.detected', {
                projectId: project.project_uid,
                guildId: project.guild_id,
                openCount: unassignedTasks.length,
                tasks: unassignedTasks.slice(0, 5).map(t => ({
                    taskId: t.task_uid,
                    title: t.title,
                    createdAt: t.created_at
                })),
                occurredAt: now.toISOString()
            });
            emitted += 1;
        }
    }

    return emitted;
}

async function runInactivityCycleForGuild(guild, options = {}) {
    const config = options.config || loadInactivityConfig(process.env);
    const now = options.now || new Date();
    const emit = options.emit || notifyDomainEvent;
    const projects = await listProjectsByGuild(guild.id);

    let emitted = 0;
    for (const project of projects) {
        try {
            emitted += await evaluateProjectSignals(project, now, config, emit);
        } catch (err) {
            handleWorkerError('inactivityDetectionWorker', err, { guildId: guild.id, projectId: project.project_uid });
            metrics.increment('worker_failure_total', 1, { worker: 'inactivityDetectionWorker' });
        }
    }

    if (emitted > 0) {
        metrics.increment('worker_processed_total', emitted, { worker: 'inactivityDetectionWorker' });
    }

    return emitted;
}

function startInactivityDetectionWorker(client) {
    if (timer) return;
    const config = loadInactivityConfig(process.env);

    timer = setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            await runInactivityCycleForGuild(guild, { config, now: new Date() });
        }
    }, config.intervalMs);
}

function resetInactivityWorkerState() {
    signalState.clear();
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}

module.exports = {
    startInactivityDetectionWorker,
    runInactivityCycleForGuild,
    resetInactivityWorkerState,
    evaluateProjectSignals
};

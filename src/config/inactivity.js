function toInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) ? n : fallback;
}

function loadInactivityConfig(env = process.env) {
    return {
        intervalMs: toInt(env.INACTIVITY_WORKER_INTERVAL_MS, 300000),
        feedLimit: toInt(env.INACTIVITY_FEED_LIMIT, 50),
        projectInactiveDays: toInt(env.PROJECT_INACTIVE_DAYS, 7),
        staleSprintDays: toInt(env.STALE_SPRINT_DAYS, 14),
        unassignedTaskDays: toInt(env.UNASSIGNED_TASK_DAYS, 3),
        signalCooldownHours: toInt(env.INACTIVITY_SIGNAL_COOLDOWN_HOURS, 24)
    };
}

module.exports = {
    loadInactivityConfig
};

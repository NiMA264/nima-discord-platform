const { loadDigestConfig } = require('../config/digest');
const { listProjectsByGuild } = require('../repositories/projectRepository');
const { getProjectActivityFeed } = require('../services/projectActivityFeedService');
const { notifyDomainEvent } = require('../services/notificationService');
const { handleWorkerError } = require('../lib/handleWorkerError');
const metrics = require('../lib/metrics');

let timer;
const lastRun = new Map();

function isoDayKey(date) {
    return date.toISOString().slice(0, 10);
}

function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shouldRunDaily(projectUid, now, config) {
    if (now.getUTCHours() !== config.dailyHourUtc) return false;
    const key = `${projectUid}:daily`;
    const stamp = isoDayKey(now);
    if (lastRun.get(key) === stamp) return false;
    lastRun.set(key, stamp);
    return true;
}

function shouldRunWeekly(projectUid, now, config) {
    if (now.getUTCDay() !== config.weeklyDayUtc) return false;
    if (now.getUTCHours() !== config.weeklyHourUtc) return false;
    const key = `${projectUid}:weekly`;
    const stamp = isoWeekKey(now);
    if (lastRun.get(key) === stamp) return false;
    lastRun.set(key, stamp);
    return true;
}

function buildDigestSummary(activity, period, now) {
    const entries = activity.feed.slice(0, 8).map((entry, idx) =>
        `${idx + 1}. ${entry.type} | ${entry.summary} | ${entry.timestamp}`
    );

    return [
        `${period.toUpperCase()} DIGEST`,
        `project=${activity.project.name} (${activity.project.project_uid})`,
        `generatedAt=${now.toISOString()}`,
        `counts: logs=${activity.counts.logs}, tasks=${activity.counts.tasks}, sprints=${activity.counts.sprints}`,
        'recent:',
        ...(entries.length ? entries : ['- no recent activity'])
    ].join('\n');
}

async function emitProjectDigest(project, period, now, config, emit) {
    const activity = await getProjectActivityFeed(project.project_uid, { limit: config.feedLimit });
    if (!activity) return false;

    const summary = buildDigestSummary(activity, period, now);
    await emit(`project.digest.${period}`, {
        projectId: project.project_uid,
        guildId: project.guild_id,
        period,
        summary,
        counts: activity.counts,
        occurredAt: now.toISOString()
    });

    return true;
}

async function runDigestCycleForGuild(guild, options = {}) {
    const config = options.config || loadDigestConfig(process.env);
    const now = options.now || new Date();
    const emit = options.emit || notifyDomainEvent;
    const projects = await listProjectsByGuild(guild.id);

    let emitted = 0;
    for (const project of projects) {
        try {
            if (shouldRunDaily(project.project_uid, now, config)) {
                const ok = await emitProjectDigest(project, 'daily', now, config, emit);
                if (ok) emitted += 1;
            }

            if (shouldRunWeekly(project.project_uid, now, config)) {
                const ok = await emitProjectDigest(project, 'weekly', now, config, emit);
                if (ok) emitted += 1;
            }
        } catch (err) {
            handleWorkerError('digestWorker', err, { guildId: guild.id, projectId: project.project_uid });
            metrics.increment('worker_failure_total', 1, { worker: 'digestWorker' });
        }
    }

    if (emitted > 0) {
        metrics.increment('worker_processed_total', emitted, { worker: 'digestWorker' });
    }

    return emitted;
}

function startScheduledDigestWorker(client) {
    if (timer) return;
    const config = loadDigestConfig(process.env);

    timer = setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            await runDigestCycleForGuild(guild, { config, now: new Date() });
        }
    }, config.intervalMs);
}

function resetDigestWorkerState() {
    lastRun.clear();
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}

module.exports = {
    startScheduledDigestWorker,
    runDigestCycleForGuild,
    buildDigestSummary,
    resetDigestWorkerState
};

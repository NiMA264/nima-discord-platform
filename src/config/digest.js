function toInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) ? n : fallback;
}

function loadDigestConfig(env = process.env) {
    return {
        intervalMs: toInt(env.DIGEST_WORKER_INTERVAL_MS, 60000),
        dailyHourUtc: toInt(env.DIGEST_DAILY_HOUR_UTC, 8),
        weeklyDayUtc: toInt(env.DIGEST_WEEKLY_DAY_UTC, 1),
        weeklyHourUtc: toInt(env.DIGEST_WEEKLY_HOUR_UTC, 8),
        feedLimit: toInt(env.DIGEST_FEED_LIMIT, 25)
    };
}

module.exports = {
    loadDigestConfig
};

const counters = new Map();
const gauges = new Map();

function key(name, labels = {}) {
    const labelPairs = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return `${name}|${JSON.stringify(labelPairs)}`;
}

function increment(name, value = 1, labels = {}) {
    const k = key(name, labels);
    counters.set(k, (counters.get(k) || 0) + value);
}

function gauge(name, value, labels = {}) {
    gauges.set(key(name, labels), Number(value));
}

function startTimer(name, labels = {}) {
    const start = Date.now();
    return {
        stop(extraLabels = {}) {
            const durationMs = Date.now() - start;
            increment(`${name}_count`, 1, { ...labels, ...extraLabels });
            increment(`${name}_total_ms`, durationMs, { ...labels, ...extraLabels });
            return durationMs;
        }
    };
}

function snapshot() {
    return {
        counters: Object.fromEntries(counters.entries()),
        gauges: Object.fromEntries(gauges.entries())
    };
}

module.exports = {
    increment,
    gauge,
    startTimer,
    snapshot
};

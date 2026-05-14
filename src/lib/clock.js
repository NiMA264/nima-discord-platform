let nowProvider = () => new Date();

function toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'function') {
        const result = value();
        return toDate(result);
    }
    return new Date();
}

function setNowProvider(provider) {
    nowProvider = () => toDate(provider);
}

function resetNowProvider() {
    nowProvider = () => new Date();
}

function nowDate() {
    return nowProvider();
}

function nowIso() {
    return nowDate().toISOString();
}

function nowMs() {
    return nowDate().getTime();
}

module.exports = {
    setNowProvider,
    resetNowProvider,
    nowDate,
    nowIso,
    nowMs
};

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDateTime(value) {
    if (typeof value !== 'string' || value.trim() === '') return false;
    const time = Date.parse(value);
    if (Number.isNaN(time)) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function validateEventEnvelope(envelope) {
    const value = envelope || {};
    const errors = [];

    if (!isNonEmptyString(value.event_id)) errors.push('event_id must be a non-empty string');
    if (!isNonEmptyString(value.idempotency_key)) errors.push('idempotency_key must be a non-empty string');
    if (!isNonEmptyString(value.type)) errors.push('type must be a non-empty string');
    if (!Number.isInteger(value.version) || value.version < 1) errors.push('version must be an integer >= 1');
    if (!isIsoDateTime(value.occurred_at)) errors.push('occurred_at must be an ISO-8601 UTC datetime string');
    if (!isNonEmptyString(value.workspace_id)) errors.push('workspace_id must be a non-empty string');
    if (!isNonEmptyString(value.source)) errors.push('source must be a non-empty string');
    if (!isObject(value.payload)) errors.push('payload must be an object');

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateEventEnvelope
};

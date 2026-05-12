const githubContracts = require('./contracts/v1/github-domain-events.json');

function isIsoDateTime(value) {
    if (typeof value !== 'string' || value.trim() === '') return false;
    const time = Date.parse(value);
    if (Number.isNaN(time)) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value);
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateDomainEventEnvelope(event) {
    const errors = [];
    const value = event || {};

    if (typeof value.eventId !== 'string' || value.eventId.trim() === '') {
        errors.push('eventId is required and must be a non-empty string');
    }

    if (typeof value.eventType !== 'string' || value.eventType.trim() === '') {
        errors.push('eventType is required and must be a non-empty string');
    }

    if (!Number.isInteger(value.eventVersion) || value.eventVersion < 1) {
        errors.push('eventVersion is required and must be an integer >= 1');
    }

    if (!isIsoDateTime(value.occurredAt)) {
        errors.push('occurredAt is required and must be an ISO-8601 UTC datetime string');
    }

    if (typeof value.source !== 'string' || value.source.trim() === '') {
        errors.push('source is required and must be a non-empty string');
    }

    if (!isObject(value.payload)) {
        errors.push('payload is required and must be an object');
    }

    const contractsByType = githubContracts?.events || {};
    const eventType = typeof value.eventType === 'string' ? value.eventType.trim() : '';
    if (eventType && !contractsByType[eventType]) {
        errors.push(`eventType is unknown: ${eventType}`);
    }

    if (eventType && Number(value.eventVersion) === 1 && contractsByType[eventType] && isObject(value.payload)) {
        const requiredMetadata = Array.isArray(contractsByType[eventType].requiredMetadata)
            ? contractsByType[eventType].requiredMetadata
            : [];

        for (const field of requiredMetadata) {
            if (!(field in value.payload)) {
                errors.push(`payload is missing required field for ${eventType}: ${field}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateDomainEventEnvelope
};

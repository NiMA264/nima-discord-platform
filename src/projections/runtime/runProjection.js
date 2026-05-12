const { getProjectionsForEventType } = require('../registry/projectionRegistry');
const { replayProjection } = require('./replayProjection');

function toTimestamp(event) {
    const value = event?.occurredAt || event?.createdAt || '';
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
}

function eventKey(event) {
    return String(event?.eventId || event?.eventUid || '');
}

function sortEventsDeterministically(events) {
    return (Array.isArray(events) ? events : [])
        .map((event, index) => ({ event, index }))
        .sort((a, b) => {
            const byTime = toTimestamp(a.event) - toTimestamp(b.event);
            if (byTime !== 0) return byTime;
            const byKey = eventKey(a.event).localeCompare(eventKey(b.event));
            if (byKey !== 0) return byKey;
            return a.index - b.index;
        })
        .map(item => item.event);
}

function runProjection(events, initialState = {}, options = {}) {
    const sortedEvents = sortEventsDeterministically(events);
    const unknownEvents = [];

    const finalState = replayProjection(
        sortedEvents,
        (state, event) => {
            const eventType = String(event?.type || event?.eventType || '').trim();
            const projections = getProjectionsForEventType(eventType);

            if (!projections.length) {
                unknownEvents.push(event);
                return state;
            }

            return projections.reduce((nextState, apply) => apply(nextState, event), state);
        },
        initialState
    );

    if (options.collectUnknownEvents === false) {
        return { state: finalState, unknownEvents: [] };
    }

    return {
        state: finalState,
        unknownEvents
    };
}

module.exports = {
    runProjection,
    sortEventsDeterministically
};

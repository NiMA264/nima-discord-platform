const { warn } = require('../utils/logger');

const adapters = [];

function registerNotificationAdapter(adapter) {
    if (!adapter || typeof adapter.deliver !== 'function') {
        throw new Error('Invalid notification adapter');
    }

    adapters.push(adapter);
}

function clearNotificationAdapters() {
    adapters.length = 0;
}

function buildNotification(eventName, payload) {
    const projectId = payload?.projectId || payload?.projectUid || null;

    return {
        eventName,
        projectId,
        occurredAt: payload?.occurredAt || new Date().toISOString(),
        payload
    };
}

async function notifyDomainEvent(eventName, payload) {
    if (adapters.length === 0) return;

    const notification = buildNotification(eventName, payload);

    for (const adapter of adapters) {
        try {
            await adapter.deliver(notification);
        } catch (err) {
            warn('Notification delivery failed', {
                adapter: adapter.name || 'unknown',
                eventName,
                error: err?.message || String(err)
            });
        }
    }
}

module.exports = {
    registerNotificationAdapter,
    clearNotificationAdapters,
    notifyDomainEvent
};

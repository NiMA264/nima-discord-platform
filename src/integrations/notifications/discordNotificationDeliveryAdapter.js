const { findProjectByUid } = require('../../repositories/projectRepository');

let discordClient = null;

function setDiscordNotificationClient(client) {
    discordClient = client;
}

function formatMessage(notification) {
    const payload = notification.payload || {};

    if (notification.eventName === 'task.assigned') {
        return `Task assigned: ${payload.taskTitle || payload.taskId} -> <@${payload.assigneeUserId}>`;
    }

    if (notification.eventName === 'task.closed') {
        return `Task closed: ${payload.taskTitle || payload.taskId}`;
    }

    if (notification.eventName === 'sprint.started') {
        return `Sprint started: ${payload.sprintTitle || payload.sprintId}`;
    }

    if (notification.eventName === 'sprint.closed') {
        return `Sprint closed: ${payload.sprintTitle || payload.sprintId}`;
    }

    if (notification.eventName === 'github.activity.received') {
        return `GitHub activity: ${payload.summary || payload.type || 'update'}${payload.url ? ` (${payload.url})` : ''}`;
    }

    return null;
}

function createDiscordNotificationAdapter() {
    return {
        name: 'discord',
        async deliver(notification) {
            if (!discordClient) return;
            if (!notification.projectId) return;

            const project = await findProjectByUid(notification.projectId);
            if (!project?.thread_id) return;

            const channel = await discordClient.channels.fetch(project.thread_id).catch(() => null);
            if (!channel || typeof channel.send !== 'function') return;

            const message = formatMessage(notification);
            if (!message) return;

            await channel.send({ content: `[notification] ${message}` });
        }
    };
}

module.exports = {
    createDiscordNotificationAdapter,
    setDiscordNotificationClient
};

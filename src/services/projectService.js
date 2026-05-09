const crypto = require('crypto');
const { ProjectRole } = require('../domain/projectRole');
const {
    createProjectEntity,
    upsertProjectMember,
    createProjectLog,
    updateProjectThreadId
} = require('../repositories/projectRepository');

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function generateProjectUid() {
    return crypto.randomUUID();
}

function createProject(payload) {
    const projectUid = generateProjectUid();
    const slug = `${slugify(payload.name)}-${projectUid.slice(0, 8)}`;

    createProjectEntity({
        projectUid,
        guildId: payload.guildId,
        threadId: 'pending',
        creatorId: payload.creatorId,
        name: payload.name,
        slug,
        description: payload.description,
        stack: payload.stack,
        status: payload.status,
        forumChannelId: payload.forumChannelId,
        createdAt: payload.createdAt
    });

    upsertProjectMember({
        projectUid,
        userId: payload.creatorId,
        role: ProjectRole.PROJECT_LEAD,
        createdAt: payload.createdAt
    });

    createProjectLog({
        projectUid,
        source: 'DISCORD',
        eventType: 'project.created',
        content: {
            name: payload.name,
            description: payload.description,
            status: payload.status,
            type: payload.type,
            stack: payload.stack,
            createdBy: payload.creatorId
        },
        createdAt: payload.createdAt
    });

    return { projectUid, slug };
}

function setDiscordThread(projectUid, threadId) {
    updateProjectThreadId(projectUid, threadId);
    createProjectLog({
        projectUid,
        source: 'SYSTEM',
        eventType: 'project.thread_linked',
        content: { threadId }
    });
}

module.exports = {
    createProject,
    setDiscordThread
};

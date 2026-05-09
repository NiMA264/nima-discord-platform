const crypto = require('crypto');
const { ProjectRole } = require('../domain/projectRole');
const {
    createProjectEntity,
    upsertProjectMember,
    createProjectLog,
    updateProjectThreadId,
    findProjectByName,
    findProjectByUid,
    archiveProject: archiveProjectRepository,
    removeProjectMember,
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

async function createProject(payload) {
    const projectUid = generateProjectUid();
    const slug = `${slugify(payload.name)}-${projectUid.slice(0, 8)}`;

    await createProjectEntity({
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

    await upsertProjectMember({
        projectUid,
        userId: payload.creatorId,
        role: ProjectRole.PROJECT_LEAD,
        createdAt: payload.createdAt
    });

    await createProjectLog({
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

async function setDiscordThread(projectUid, threadId) {
    await updateProjectThreadId(projectUid, threadId);
    await createProjectLog({
        projectUid,
        source: 'SYSTEM',
        eventType: 'project.thread_linked',
        content: { threadId }
    });
}

async function addProjectLog({ guildId, projectName, entry, userId }) {
    const project = await findProjectByName(guildId, projectName);
    if (!project) return null;

    await createProjectLog({
        projectUid: project.project_uid,
        source: 'DISCORD',
        eventType: 'project.log_added',
        content: {
            entry,
            userId,
            threadId: project.thread_id
        }
    });

    return project;
}

async function archiveProject(projectUid, userId) {
    const project = await findProjectByUid(projectUid);
    if (!project) return null;

    await archiveProjectRepository(projectUid);
    await createProjectLog({
        projectUid,
        source: 'SYSTEM',
        eventType: 'project.archived',
        content: { archivedBy: userId }
    });

    return project;
}

async function addProjectMember(projectUid, userId, role, actorId) {
    const project = await findProjectByUid(projectUid);
    if (!project) return null;

    await upsertProjectMember({ projectUid, userId, role });
    await createProjectLog({
        projectUid,
        source: 'SYSTEM',
        eventType: 'project.member_added',
        content: { userId, role, actorId }
    });

    return project;
}

async function removeMemberFromProject(projectUid, userId, actorId) {
    const project = await findProjectByUid(projectUid);
    if (!project) return null;

    await removeProjectMember(projectUid, userId);
    await createProjectLog({
        projectUid,
        source: 'SYSTEM',
        eventType: 'project.member_removed',
        content: { userId, actorId }
    });

    return project;
}

module.exports = {
    createProject,
    setDiscordThread,
    addProjectLog,
    archiveProject,
    addProjectMember,
    removeMemberFromProject
};

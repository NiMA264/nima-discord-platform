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
const { inspectSingleProject } = require('../reconciliation/projectReconciliation');

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

async function repairProject({ guild, projectId, actorId }) {
    const project = await findProjectByUid(projectId);
    if (!project) return null;

    const report = await inspectSingleProject(guild, project);
    const actions = [];

    for (const issue of report.issues) {
        if (issue.type === 'name_drift' && issue.details?.threadId) {
            const thread = guild.channels.cache.get(issue.details.threadId)
                || await guild.channels.fetch(issue.details.threadId).catch(() => null);
            if (thread) {
                await thread.setName(project.name);
                actions.push({ type: 'rename_thread', threadId: thread.id, name: project.name });
            }
        }

        if (issue.type === 'missing_thread') {
            const forum = project.forum_channel_id
                ? guild.channels.cache.get(project.forum_channel_id) || await guild.channels.fetch(project.forum_channel_id).catch(() => null)
                : null;

            if (forum?.threads?.create) {
                const recreated = await forum.threads.create({
                    name: project.name,
                    message: {
                        content: `## Project: ${project.name}\nID: ${project.project_uid}\n\n### Recovery\nThread recreated by repair.`
                    }
                });
                await updateProjectThreadId(project.project_uid, recreated.id);
                actions.push({ type: 'recreate_thread', threadId: recreated.id });
            }
        }
    }

    await createProjectLog({
        projectUid: project.project_uid,
        source: 'SYSTEM',
        eventType: 'project.repaired',
        content: {
            actorId,
            actions,
            previousIssues: report.issues
        }
    });

    const postRepair = await inspectSingleProject(guild, await findProjectByUid(project.project_uid));
    return {
        project,
        before: report,
        actions,
        after: postRepair
    };
}

module.exports = {
    createProject,
    setDiscordThread,
    addProjectLog,
    archiveProject,
    addProjectMember,
    removeMemberFromProject,
    repairProject
};

const { getPrisma } = require('../lib/prisma');
const sqliteAdapter = require('./projectRepository.sqlite');
const { ProjectRole } = require('../domain/projectRole');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');

function useFallback() {
    return process.env.PROJECT_REPO_ADAPTER === 'sqlite';
}

function rowOrNull(rows) {
    return rows.length ? rows[0] : null;
}

async function createProjectEntity(data) {
    if (useFallback()) return sqliteAdapter.createProjectEntity(data);

    const workspaceId = resolveWorkspaceId({ userId: data.creatorId, explicitWorkspaceId: data.workspaceId, guildId: data.guildId });
    const prisma = getPrisma();
    await prisma.$executeRaw`
        INSERT INTO projects (
            project_uid, workspace_id, guild_id, thread_id, creator_id, name, slug, description, stack, status, forum_channel_id, created_at
        ) VALUES (
            ${data.projectUid}, ${workspaceId}, ${data.guildId}, ${data.threadId || 'pending'}, ${data.creatorId}, ${data.name}, ${data.slug},
            ${data.description || ''}, ${data.stack || ''}, ${data.status}, ${data.forumChannelId || null}, ${data.createdAt || new Date().toISOString()}
        )
    `;

    return { project_uid: data.projectUid };
}

async function updateProjectThreadId(projectUid, threadId) {
    if (useFallback()) return sqliteAdapter.updateProjectThreadId(projectUid, threadId);
    const prisma = getPrisma();
    return prisma.$executeRaw`UPDATE projects SET thread_id = ${threadId} WHERE project_uid = ${projectUid}`;
}

async function findProjectByName(guildId, name, options = {}) {
    if (useFallback()) return sqliteAdapter.findProjectByName(guildId, name, options);
    const workspaceId = resolveWorkspaceId({ guildId, explicitWorkspaceId: options.workspaceId });
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT * FROM projects
        WHERE workspace_id = ${workspaceId} AND guild_id = ${guildId} AND lower(name) = lower(${name})
        ORDER BY id DESC LIMIT 1
    `;
    return rowOrNull(rows);
}

async function findProjectByUid(projectUid, workspaceIdInput) {
    if (useFallback()) return sqliteAdapter.findProjectByUid(projectUid, workspaceIdInput);
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT * FROM projects WHERE project_uid = ${projectUid} AND workspace_id = ${workspaceId} LIMIT 1
    `;
    return rowOrNull(rows);
}

async function listProjectLogs(projectUid, limit = 30, workspaceIdInput) {
    if (useFallback()) return sqliteAdapter.listProjectLogs(projectUid, limit, workspaceIdInput);
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT * FROM project_logs
        WHERE project_uid = ${projectUid} AND workspace_id = ${workspaceId}
        ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map(row => ({
        ...row,
        content: (() => {
            try {
                return JSON.parse(row.content);
            } catch (_) {
                return {};
            }
        })()
    }));
}

async function listProjectsByGuild(guildId, options = {}) {
    if (useFallback()) return sqliteAdapter.listProjectsByGuild(guildId, options);
    const workspaceId = resolveWorkspaceId({ guildId, explicitWorkspaceId: options.workspaceId });
    const prisma = getPrisma();
    return prisma.$queryRaw`
        SELECT * FROM projects WHERE workspace_id = ${workspaceId} AND guild_id = ${guildId} ORDER BY id DESC
    `;
}

async function listProjectMembers(projectUid) {
    if (useFallback()) return sqliteAdapter.listProjectMembers(projectUid);
    const prisma = getPrisma();
    return prisma.$queryRaw`
        SELECT user_id, role, created_at
        FROM project_members
        WHERE project_uid = ${projectUid}
        ORDER BY created_at ASC
    `;
}

async function upsertProjectMember({ projectUid, userId, role = ProjectRole.CONTRIBUTOR, createdAt }) {
    if (useFallback()) return sqliteAdapter.upsertProjectMember({ projectUid, userId, role, createdAt });
    const prisma = getPrisma();
    return prisma.$executeRaw`
        INSERT INTO project_members (project_uid, user_id, role, created_at)
        VALUES (${projectUid}, ${userId}, ${role}, ${createdAt || new Date().toISOString()})
        ON CONFLICT(project_uid, user_id) DO UPDATE SET role = excluded.role
    `;
}

async function removeProjectMember(projectUid, userId) {
    if (useFallback()) return sqliteAdapter.removeProjectMember(projectUid, userId);
    const prisma = getPrisma();
    return prisma.$executeRaw`DELETE FROM project_members WHERE project_uid = ${projectUid} AND user_id = ${userId}`;
}

async function archiveProject(projectUid) {
    if (useFallback()) return sqliteAdapter.archiveProject(projectUid);
    const prisma = getPrisma();
    return prisma.$executeRaw`UPDATE projects SET status = 'archived' WHERE project_uid = ${projectUid}`;
}

async function findProjectMemberRole(projectUid, userId) {
    if (useFallback()) return sqliteAdapter.findProjectMemberRole(projectUid, userId);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT role FROM project_members WHERE project_uid = ${projectUid} AND user_id = ${userId} LIMIT 1
    `;
    return rows.length ? rows[0].role : null;
}

async function hasGuildProjectLeadOrMaintainerRole(guildId, userId) {
    if (useFallback()) return sqliteAdapter.hasGuildProjectLeadOrMaintainerRole(guildId, userId);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT pm.role
        FROM project_members pm
        JOIN projects p ON p.project_uid = pm.project_uid
        WHERE p.guild_id = ${guildId}
          AND pm.user_id = ${userId}
          AND pm.role IN ('PROJECT_LEAD', 'MAINTAINER')
        LIMIT 1
    `;
    return rows.length > 0;
}

async function createProjectLog({ projectUid, source, eventType, content, createdAt, workspaceId: workspaceIdInput }) {
    if (useFallback()) return sqliteAdapter.createProjectLog({ projectUid, source, eventType, content, createdAt, workspaceId: workspaceIdInput });
    const prisma = getPrisma();
    let workspaceId = workspaceIdInput;
    if (!workspaceId) {
        const row = rowOrNull(await prisma.$queryRaw`SELECT workspace_id FROM projects WHERE project_uid = ${projectUid} LIMIT 1`);
        workspaceId = row?.workspace_id;
    }
    workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceId });

    return prisma.$executeRaw`
        INSERT INTO project_logs (project_uid, workspace_id, source, event_type, content, created_at)
        VALUES (${projectUid}, ${workspaceId}, ${source}, ${eventType}, ${JSON.stringify(content || {})}, ${createdAt || new Date().toISOString()})
    `;
}

module.exports = {
    createProjectEntity,
    updateProjectThreadId,
    findProjectByName,
    findProjectByUid,
    listProjectLogs,
    listProjectsByGuild,
    listProjectMembers,
    upsertProjectMember,
    removeProjectMember,
    archiveProject,
    findProjectMemberRole,
    hasGuildProjectLeadOrMaintainerRole,
    createProjectLog
};

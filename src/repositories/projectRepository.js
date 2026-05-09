const { getPrisma } = require('../lib/prisma');
const sqliteAdapter = require('./projectRepository.sqlite');
const { ProjectRole } = require('../domain/projectRole');

function useFallback() {
    return process.env.PROJECT_REPO_ADAPTER === 'sqlite';
}

function rowOrNull(rows) {
    return rows.length ? rows[0] : null;
}

async function createProjectEntity(data) {
    if (useFallback()) return sqliteAdapter.createProjectEntity(data);

    const prisma = getPrisma();
    await prisma.$executeRaw`
        INSERT INTO projects (
            project_uid, guild_id, thread_id, creator_id, name, slug, description, stack, status, forum_channel_id, created_at
        ) VALUES (
            ${data.projectUid}, ${data.guildId}, ${data.threadId || 'pending'}, ${data.creatorId}, ${data.name}, ${data.slug},
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

async function findProjectByName(guildId, name) {
    if (useFallback()) return sqliteAdapter.findProjectByName(guildId, name);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT * FROM projects WHERE guild_id = ${guildId} AND lower(name) = lower(${name}) ORDER BY id DESC LIMIT 1
    `;
    return rowOrNull(rows);
}

async function findProjectByUid(projectUid) {
    if (useFallback()) return sqliteAdapter.findProjectByUid(projectUid);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`SELECT * FROM projects WHERE project_uid = ${projectUid} LIMIT 1`;
    return rowOrNull(rows);
}

async function listProjectLogs(projectUid, limit = 30) {
    if (useFallback()) return sqliteAdapter.listProjectLogs(projectUid, limit);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`
        SELECT * FROM project_logs WHERE project_uid = ${projectUid} ORDER BY created_at DESC LIMIT ${limit}
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

async function listProjectsByGuild(guildId) {
    if (useFallback()) return sqliteAdapter.listProjectsByGuild(guildId);
    const prisma = getPrisma();
    return prisma.$queryRaw`SELECT * FROM projects WHERE guild_id = ${guildId} ORDER BY id DESC`;
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

async function createProjectLog({ projectUid, source, eventType, content, createdAt }) {
    if (useFallback()) return sqliteAdapter.createProjectLog({ projectUid, source, eventType, content, createdAt });
    const prisma = getPrisma();
    return prisma.$executeRaw`
        INSERT INTO project_logs (project_uid, source, event_type, content, created_at)
        VALUES (${projectUid}, ${source}, ${eventType}, ${JSON.stringify(content || {})}, ${createdAt || new Date().toISOString()})
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
    createProjectLog
};

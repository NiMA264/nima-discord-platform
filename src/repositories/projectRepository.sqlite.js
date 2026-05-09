const { getDatabase } = require('../database/database');
const { ProjectRole } = require('../domain/projectRole');

const db = getDatabase();

const statements = {
    createProject: db.prepare(`
        INSERT INTO projects (
            project_uid, guild_id, thread_id, creator_id, name, slug, description, stack, status, forum_channel_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateProjectThreadId: db.prepare(`
        UPDATE projects
        SET thread_id = ?
        WHERE project_uid = ?
    `),
    findByName: db.prepare(`
        SELECT * FROM projects
        WHERE guild_id = ? AND lower(name) = lower(?)
        ORDER BY id DESC
        LIMIT 1
    `),
    findByUid: db.prepare(`
        SELECT * FROM projects
        WHERE project_uid = ?
        LIMIT 1
    `),
    listLogsByProject: db.prepare(`
        SELECT * FROM project_logs
        WHERE project_uid = ?
        ORDER BY created_at DESC
        LIMIT ?
    `),
    listByGuild: db.prepare(`
        SELECT * FROM projects
        WHERE guild_id = ?
        ORDER BY id DESC
    `),
    upsertProjectMember: db.prepare(`
        INSERT INTO project_members (project_uid, user_id, role, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(project_uid, user_id)
        DO UPDATE SET role = excluded.role
    `),
    removeProjectMember: db.prepare(`
        DELETE FROM project_members
        WHERE project_uid = ? AND user_id = ?
    `),
    archiveProject: db.prepare(`
        UPDATE projects
        SET status = 'archived'
        WHERE project_uid = ?
    `),
    findMemberRole: db.prepare(`
        SELECT role
        FROM project_members
        WHERE project_uid = ? AND user_id = ?
        LIMIT 1
    `),
    insertProjectLog: db.prepare(`
        INSERT INTO project_logs (project_uid, source, event_type, content, created_at)
        VALUES (?, ?, ?, ?, ?)
    `)
};

async function createProjectEntity(data) {
    const now = data.createdAt || new Date().toISOString();
    statements.createProject.run(
        data.projectUid,
        data.guildId,
        data.threadId || 'pending',
        data.creatorId,
        data.name,
        data.slug,
        data.description || '',
        data.stack || '',
        data.status,
        data.forumChannelId || null,
        now
    );
    return { project_uid: data.projectUid };
}

async function updateProjectThreadId(projectUid, threadId) {
    return statements.updateProjectThreadId.run(threadId, projectUid);
}

async function findProjectByName(guildId, name) {
    return statements.findByName.get(guildId, name) || null;
}

async function findProjectByUid(projectUid) {
    return statements.findByUid.get(projectUid) || null;
}

async function listProjectLogs(projectUid, limit = 30) {
    const rows = statements.listLogsByProject.all(projectUid, limit);
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
    return statements.listByGuild.all(guildId);
}

async function upsertProjectMember({ projectUid, userId, role = ProjectRole.CONTRIBUTOR, createdAt }) {
    return statements.upsertProjectMember.run(projectUid, userId, role, createdAt || new Date().toISOString());
}

async function removeProjectMember(projectUid, userId) {
    return statements.removeProjectMember.run(projectUid, userId);
}

async function archiveProject(projectUid) {
    return statements.archiveProject.run(projectUid);
}

async function findProjectMemberRole(projectUid, userId) {
    const row = statements.findMemberRole.get(projectUid, userId);
    return row ? row.role : null;
}

async function createProjectLog({ projectUid, source, eventType, content, createdAt }) {
    return statements.insertProjectLog.run(
        projectUid,
        source,
        eventType,
        JSON.stringify(content || {}),
        createdAt || new Date().toISOString()
    );
}

module.exports = {
    createProjectEntity,
    updateProjectThreadId,
    findProjectByName,
    findProjectByUid,
    listProjectLogs,
    listProjectsByGuild,
    upsertProjectMember,
    removeProjectMember,
    archiveProject,
    findProjectMemberRole,
    createProjectLog
};

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
    createProjectMember: db.prepare(`
        INSERT INTO project_members (project_uid, user_id, role, created_at)
        VALUES (?, ?, ?, ?)
    `),
    upsertProjectMember: db.prepare(`
        INSERT INTO project_members (project_uid, user_id, role, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(project_uid, user_id)
        DO UPDATE SET role = excluded.role
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
    `),
    createLegacyProject: db.prepare(`
        INSERT INTO projects (guild_id, thread_id, creator_id, name, description, stack, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
};

function createProject(data) {
    const now = data.createdAt || new Date().toISOString();
    if (data.projectUid) {
        return statements.createProject.run(
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
    }

    return statements.createLegacyProject.run(
        data.guildId,
        data.threadId,
        data.creatorId,
        data.name,
        data.description,
        data.stack,
        data.status,
        now
    );
}

function createProjectEntity(data) {
    return createProject(data);
}

function updateProjectThreadId(projectUid, threadId) {
    return statements.updateProjectThreadId.run(threadId, projectUid);
}

function findProjectByName(guildId, name) {
    return statements.findByName.get(guildId, name);
}

function findProjectByUid(projectUid) {
    return statements.findByUid.get(projectUid);
}

function upsertProjectMember({ projectUid, userId, role = ProjectRole.CONTRIBUTOR, createdAt }) {
    return statements.upsertProjectMember.run(projectUid, userId, role, createdAt || new Date().toISOString());
}

function findProjectMemberRole(projectUid, userId) {
    const row = statements.findMemberRole.get(projectUid, userId);
    return row ? row.role : null;
}

function createProjectLog({ projectUid, source, eventType, content, createdAt }) {
    return statements.insertProjectLog.run(
        projectUid,
        source,
        eventType,
        JSON.stringify(content || {}),
        createdAt || new Date().toISOString()
    );
}

module.exports = {
    createProject,
    createProjectEntity,
    updateProjectThreadId,
    findProjectByName,
    findProjectByUid,
    upsertProjectMember,
    findProjectMemberRole,
    createProjectLog
};

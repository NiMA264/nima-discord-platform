const { getDatabase } = require('../database/database');
const { ProjectRole } = require('../domain/projectRole');
const { resolveWorkspaceId } = require('../domain/workspace/workspaceContext');
const { ensurePhase1Persistence } = require('../database/phase1PersistenceMigration');

ensurePhase1Persistence();
const db = getDatabase();

const statements = {
    createProject: db.prepare(`
        INSERT INTO projects (
            project_uid, workspace_id, guild_id, thread_id, creator_id, name, slug, description, stack, status, forum_channel_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateProjectThreadId: db.prepare(`
        UPDATE projects
        SET thread_id = ?
        WHERE project_uid = ?
    `),
    findByName: db.prepare(`
        SELECT * FROM projects
        WHERE workspace_id = ? AND guild_id = ? AND lower(name) = lower(?)
        ORDER BY id DESC
        LIMIT 1
    `),
    findByUid: db.prepare(`
        SELECT * FROM projects
        WHERE project_uid = ? AND workspace_id = ?
        LIMIT 1
    `),
    listLogsByProject: db.prepare(`
        SELECT * FROM project_logs
        WHERE project_uid = ? AND workspace_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `),
    listByGuild: db.prepare(`
        SELECT * FROM projects
        WHERE workspace_id = ? AND guild_id = ?
        ORDER BY id DESC
    `),
    listMembersByProject: db.prepare(`
        SELECT user_id, role, created_at
        FROM project_members
        WHERE project_uid = ?
        ORDER BY created_at ASC
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
    findGuildMemberRole: db.prepare(`
        SELECT pm.role
        FROM project_members pm
        JOIN projects p ON p.project_uid = pm.project_uid
        WHERE p.guild_id = ? AND pm.user_id = ? AND pm.role IN ('PROJECT_LEAD', 'MAINTAINER')
        LIMIT 1
    `),
    insertProjectLog: db.prepare(`
        INSERT INTO project_logs (project_uid, workspace_id, source, event_type, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    findProjectWorkspace: db.prepare(`
        SELECT workspace_id FROM projects WHERE project_uid = ? LIMIT 1
    `)
};

async function createProjectEntity(data) {
    const now = data.createdAt || new Date().toISOString();
    const workspaceId = resolveWorkspaceId({
        userId: data.creatorId,
        explicitWorkspaceId: data.workspaceId,
        guildId: data.guildId
    });
    statements.createProject.run(
        data.projectUid,
        workspaceId,
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

async function findProjectByName(guildId, name, options = {}) {
    const workspaceId = resolveWorkspaceId({ guildId, explicitWorkspaceId: options.workspaceId });
    return statements.findByName.get(workspaceId, guildId, name) || null;
}

async function findProjectByUid(projectUid, workspaceIdInput) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    return statements.findByUid.get(projectUid, workspaceId) || null;
}

async function listProjectLogs(projectUid, limit = 30, workspaceIdInput) {
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput });
    const rows = statements.listLogsByProject.all(projectUid, workspaceId, limit);
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
    const workspaceId = resolveWorkspaceId({ guildId, explicitWorkspaceId: options.workspaceId });
    return statements.listByGuild.all(workspaceId, guildId);
}

async function listProjectMembers(projectUid) {
    return statements.listMembersByProject.all(projectUid);
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

async function hasGuildProjectLeadOrMaintainerRole(guildId, userId) {
    const row = statements.findGuildMemberRole.get(guildId, userId);
    return Boolean(row);
}

async function createProjectLog({ projectUid, source, eventType, content, createdAt, workspaceId: workspaceIdInput }) {
    const derivedWorkspaceId = statements.findProjectWorkspace.get(projectUid)?.workspace_id;
    const workspaceId = resolveWorkspaceId({ explicitWorkspaceId: workspaceIdInput || derivedWorkspaceId });
    return statements.insertProjectLog.run(
        projectUid,
        workspaceId,
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
    listProjectMembers,
    upsertProjectMember,
    removeProjectMember,
    archiveProject,
    findProjectMemberRole,
    hasGuildProjectLeadOrMaintainerRole,
    createProjectLog
};

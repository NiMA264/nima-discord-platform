const path = require('path');

const projectRepository = require(path.resolve(__dirname, '../../../src/repositories/projectRepository'));
const taskRepository = require(path.resolve(__dirname, '../../../src/repositories/taskRepository'));
const sprintRepository = require(path.resolve(__dirname, '../../../src/repositories/sprintRepository'));
const roleBindingRepository = require(path.resolve(__dirname, '../../../src/repositories/roleBindingRepository'));
const activityService = require(path.resolve(__dirname, '../../../src/services/projectActivityFeedService'));
const { ProjectRole, isValidProjectRole } = require(path.resolve(__dirname, '../../../src/domain/projectRole'));
const workspaceService = require(path.resolve(__dirname, '../../../src/domain/workspace/workspaceService'));
const { resolveWorkspaceId } = require(path.resolve(__dirname, '../../../src/domain/workspace/workspaceContext'));

function isGuildAdmin(guildMembership) {
    const adminBit = BigInt(0x8);
    const rawPermissions = guildMembership?.permissions;
    if (!rawPermissions) return false;

    try {
        return (BigInt(rawPermissions) & adminBit) === adminBit;
    } catch (_) {
        return false;
    }
}

async function listProjectsForGuild(guildId, options = {}) {
    if (!guildId) return [];
    const workspaceId = resolveWorkspaceId({
        userId: options.userId,
        explicitWorkspaceId: options.workspaceId,
        guildId
    });
    if (!workspaceService.getWorkspaceById(workspaceId)) return [];
    return projectRepository.listProjectsByGuild(guildId, { workspaceId });
}

async function getProjectDashboardView(projectId, options = {}) {
    if (!projectId) return null;
    const workspaceId = resolveWorkspaceId({
        userId: options.userId,
        explicitWorkspaceId: options.workspaceId,
        guildId: options.guildId
    });
    if (!workspaceService.getWorkspaceById(workspaceId)) return null;

    const activity = await activityService.getProjectActivityFeed(projectId, { limit: 25, workspaceId });
    if (!activity) return null;

    const [tasks, sprints, members] = await Promise.all([
        taskRepository.listTasksByProject(projectId, 25, workspaceId),
        sprintRepository.listSprintsByProject(projectId, 25),
        projectRepository.listProjectMembers(projectId)
    ]);

    return {
        project: activity.project,
        counts: activity.counts,
        feed: activity.feed,
        tasks,
        sprints,
        members,
        workspaceId
    };
}

function listRoleBindingsForGuild(guildId) {
    if (!guildId) return [];
    return roleBindingRepository.listRoleBindingsByGuild(guildId);
}

function updateRoleBinding({ actorGuildMembership, guildId, discordRoleId, projectRole }) {
    if (!isGuildAdmin(actorGuildMembership)) {
        return { ok: false, status: 403, error: 'Guild admin permission required.' };
    }

    if (!discordRoleId || !isValidProjectRole(projectRole)) {
        return { ok: false, status: 400, error: 'Invalid role binding payload.' };
    }

    roleBindingRepository.upsertRoleBinding({ guildId, discordRoleId, projectRole });
    return { ok: true };
}

function deleteRoleBinding({ actorGuildMembership, guildId, discordRoleId }) {
    if (!isGuildAdmin(actorGuildMembership)) {
        return { ok: false, status: 403, error: 'Guild admin permission required.' };
    }

    roleBindingRepository.removeRoleBinding({ guildId, discordRoleId });
    return { ok: true };
}

async function updateProjectMemberRole({ actorUserId, projectId, targetUserId, targetRole }) {
    if (!targetUserId || !isValidProjectRole(targetRole)) {
        return { ok: false, status: 400, error: 'Invalid member role payload.' };
    }

    // Legacy/default path: this route currently has no workspace input and relies on repository resolver boundary.
    const project = await projectRepository.findProjectByUid(projectId);
    if (!project) {
        return { ok: false, status: 404, error: 'Project not found.' };
    }

    const actorRole = await projectRepository.findProjectMemberRole(projectId, actorUserId);
    if (![ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER].includes(actorRole)) {
        return { ok: false, status: 403, error: 'Project lead or maintainer role required.' };
    }

    await projectRepository.upsertProjectMember({ projectUid: projectId, userId: targetUserId, role: targetRole });
    await projectRepository.createProjectLog({
        projectUid: projectId,
        source: 'DASHBOARD',
        eventType: 'project.member_role_updated',
        content: {
            actorUserId,
            targetUserId,
            targetRole
        }
    });

    return { ok: true };
}

module.exports = {
    listProjectsForGuild,
    getProjectDashboardView,
    listRoleBindingsForGuild,
    updateRoleBinding,
    deleteRoleBinding,
    updateProjectMemberRole,
    isGuildAdmin
};

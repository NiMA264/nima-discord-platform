const workspaceStore = require('./workspaceStore');
const membershipStore = require('./membershipStore');

function defaultWorkspaceConfig(env = process.env) {
    const defaultWorkspaceId = String(env.DEFAULT_WORKSPACE_ID || 'default-workspace').trim() || 'default-workspace';
    const defaultWorkspaceName = String(env.DEFAULT_WORKSPACE_NAME || 'Default Workspace').trim() || 'Default Workspace';
    return { defaultWorkspaceId, defaultWorkspaceName };
}

function ensureDefaultWorkspace(env = process.env) {
    const { defaultWorkspaceId, defaultWorkspaceName } = defaultWorkspaceConfig(env);
    let existing = workspaceStore.findWorkspaceById(defaultWorkspaceId);
    if (!existing) {
        existing = workspaceStore.createWorkspace({
            workspaceId: defaultWorkspaceId,
            name: defaultWorkspaceName,
            slug: workspaceStore.normalizeSlug(defaultWorkspaceName)
        });
    }
    return existing;
}

function listWorkspaces(env = process.env) {
    ensureDefaultWorkspace(env);
    return workspaceStore.listWorkspaces();
}

function getWorkspaceById(workspaceId, env = process.env) {
    ensureDefaultWorkspace(env);
    return workspaceStore.findWorkspaceById(workspaceId);
}

function createWorkspace({ name, slug, ownerUserId }, env = process.env) {
    ensureDefaultWorkspace(env);
    const workspace = workspaceStore.createWorkspace({ name, slug });
    if (ownerUserId) {
        membershipStore.upsertWorkspaceMembership({
            workspaceId: workspace.workspaceId,
            userId: ownerUserId,
            role: 'OWNER'
        });
    }
    return workspace;
}

module.exports = {
    defaultWorkspaceConfig,
    ensureDefaultWorkspace,
    listWorkspaces,
    getWorkspaceById,
    createWorkspace
};


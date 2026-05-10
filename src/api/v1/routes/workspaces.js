const workspaceService = require('../../../domain/workspace/workspaceService');

function getWorkspaces(_req, _body, context) {
    const workspaces = workspaceService.listWorkspaces(process.env);
    return {
        statusCode: 200,
        body: {
            ok: true,
            data: workspaces,
            meta: {
                resource: 'workspaces',
                version: 'v1',
                placeholder: false,
                authMode: context.authMode
            }
        }
    };
}

function postWorkspaces(_req, body, context) {
    const created = workspaceService.createWorkspace({
        name: body?.name || 'Workspace',
        slug: body?.slug || '',
        ownerUserId: body?.ownerUserId || ''
    }, process.env);

    return {
        statusCode: 201,
        body: {
            ok: true,
            data: created,
            meta: {
                resource: 'workspaces',
                version: 'v1',
                placeholder: false,
                authMode: context.authMode
            }
        }
    };
}

function getWorkspaceById(req, _body, context) {
    const workspaceId = String(req.params?.id || '');
    const workspace = workspaceService.getWorkspaceById(workspaceId, process.env);
    if (!workspace) {
        return {
            statusCode: 404,
            body: {
                ok: false,
                error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' }
            }
        };
    }

    return {
        statusCode: 200,
        body: {
            ok: true,
            data: workspace,
            meta: {
                resource: 'workspaces',
                version: 'v1',
                placeholder: false,
                authMode: context.authMode
            }
        }
    };
}

module.exports = {
    getWorkspaces,
    postWorkspaces,
    getWorkspaceById
};


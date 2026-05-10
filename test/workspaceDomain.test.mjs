import { describe, it, expect } from 'vitest';
import workspaceService from '../src/domain/workspace/workspaceService.js';

describe('workspace domain and membership model', () => {
    it('ensures default workspace fallback exists', () => {
        const env = {
            DEFAULT_WORKSPACE_ID: `ws-default-${Date.now()}`,
            DEFAULT_WORKSPACE_NAME: 'Fallback Workspace'
        };

        const workspace = workspaceService.ensureDefaultWorkspace(env);
        expect(workspace.workspaceId).toBeTruthy();
        expect(workspace.slug).toBe('fallback-workspace');
    });

    it('creates workspace and owner membership', () => {
        const workspace = workspaceService.createWorkspace({
            name: `Workspace ${Date.now()}`,
            slug: `workspace-${Date.now()}`,
            ownerUserId: 'owner-user-1'
        });

        expect(workspace.workspaceId).toBeTruthy();
        expect(workspace.name).toMatch(/Workspace/);
    });

    it('lists workspaces including default fallback', () => {
        const env = {
            DEFAULT_WORKSPACE_ID: `ws-list-${Date.now()}`,
            DEFAULT_WORKSPACE_NAME: 'List Fallback'
        };
        const list = workspaceService.listWorkspaces(env);
        const found = list.find(item => item.slug === 'list-fallback');
        expect(found).toBeTruthy();
    });
});

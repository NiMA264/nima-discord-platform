import { describe, it, expect } from 'vitest';
import { resolveWorkspaceId } from '../src/domain/workspace/workspaceContext.js';

describe('workspace context resolver', () => {
    it('returns explicit workspace id when provided', () => {
        const id = resolveWorkspaceId({
            userId: 'u1',
            explicitWorkspaceId: 'ws-explicit',
            guildId: 'g1'
        }, {
            DEFAULT_WORKSPACE_ID: 'ws-default'
        });

        expect(id).toBe('ws-explicit');
    });

    it('falls back to DEFAULT_WORKSPACE_ID when explicit id is missing', () => {
        const id = resolveWorkspaceId({
            userId: 'u1',
            explicitWorkspaceId: '',
            guildId: 'g1'
        }, {
            DEFAULT_WORKSPACE_ID: 'ws-default'
        });

        expect(id).toBe('ws-default');
    });
});


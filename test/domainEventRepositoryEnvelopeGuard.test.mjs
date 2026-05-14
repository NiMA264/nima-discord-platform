import { describe, expect, it } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const repoModule = await import('../src/repositories/domainEventRepository.js');
const { buildEventEnvelope, assertValidEnvelope } = repoModule.default || repoModule;

describe('domainEventRepository envelope guard', () => {
    it('builds a valid envelope from legacy producer input', () => {
        const envelope = buildEventEnvelope({
            workspaceId: 'default-workspace',
            type: 'project.created',
            entityType: 'project',
            entityId: 'project-1',
            metadata: { projectId: 'project-1' }
        });

        expect(() => assertValidEnvelope(envelope)).not.toThrow();
        expect(envelope.type).toBe('project.created');
        expect(envelope.workspace_id).toBe('default-workspace');
        expect(envelope.source).toBe('project');
    });

    it('throws when explicit envelope is invalid', () => {
        expect(() => assertValidEnvelope({
            event_id: '',
            idempotency_key: '',
            type: '',
            version: 0,
            occurred_at: 'bad',
            workspace_id: '',
            source: '',
            payload: null
        })).toThrow(/Domain event envelope validation failed/);
    });
});

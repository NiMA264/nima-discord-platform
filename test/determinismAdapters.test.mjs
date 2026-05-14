import { afterEach, describe, expect, it } from 'vitest';
import { setFixedNow, setUuidSequence, resetDeterminism } from './helpers/determinism.mjs';

const domainEventRepoModule = await import('../src/repositories/domainEventRepository.js');
const { buildEventEnvelope } = domainEventRepoModule.default || domainEventRepoModule;

describe('determinism adapters', () => {
    afterEach(() => {
        resetDeterminism();
    });

    it('builds deterministic legacy event envelope with providers', () => {
        setFixedNow('2026-05-14T10:00:00.000Z');
        setUuidSequence(['11111111-1111-4111-8111-111111111111']);

        const envelope = buildEventEnvelope({
            workspaceId: 'ws-1',
            type: 'project.created',
            entityType: 'project',
            entityId: 'p-1',
            metadata: { actorId: 'u-1' }
        });

        expect(envelope.event_id).toBe('11111111-1111-4111-8111-111111111111');
        expect(envelope.occurred_at).toBe('2026-05-14T10:00:00.000Z');
        expect(envelope.workspace_id).toBe('ws-1');
    });
});

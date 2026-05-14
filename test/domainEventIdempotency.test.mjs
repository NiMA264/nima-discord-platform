import { describe, expect, it } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const repoModule = await import('../src/repositories/domainEventRepository.js');
const { recordDomainEvent } = repoModule.default || repoModule;

describe('domain event idempotency guard', () => {
    it('deduplicates by same event_id', () => {
        const workspaceId = `ws-idem-${Date.now()}`;
        const first = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: `evt-${Date.now()}-1`,
            idempotency_key: `idem-${Date.now()}-1`,
            type: 'github.push',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'github',
            payload: { deliveryId: 'd-1' },
            entityType: 'repository',
            entityId: 'org/repo'
        });

        const second = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: first.eventUid,
            idempotency_key: `idem-${Date.now()}-2`,
            type: 'github.push',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'github',
            payload: { deliveryId: 'd-2' },
            entityType: 'repository',
            entityId: 'org/repo'
        });

        expect(first.deduplicated).toBe(false);
        expect(second.deduplicated).toBe(true);
        expect(second.dedupeReason).toBe('event_id');
        expect(second.eventUid).toBe(first.eventUid);
    });

    it('deduplicates by same idempotency_key in same workspace', () => {
        const workspaceId = `ws-idem-${Date.now()}-k`;
        const key = `idem-shared-${Date.now()}`;

        const first = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: `evt-${Date.now()}-a`,
            idempotency_key: key,
            type: 'github.issue.opened',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'github',
            payload: { deliveryId: 'd-3' },
            entityType: 'repository',
            entityId: 'org/repo'
        });

        const second = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: `evt-${Date.now()}-b`,
            idempotency_key: key,
            type: 'github.issue.opened',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'github',
            payload: { deliveryId: 'd-4' },
            entityType: 'repository',
            entityId: 'org/repo'
        });

        expect(second.deduplicated).toBe(true);
        expect(second.dedupeReason).toBe('idempotency_key');
        expect(second.eventUid).toBe(first.eventUid);
    });

    it('supports replay and worker retry deterministically', () => {
        const workspaceId = `ws-replay-${Date.now()}`;
        const eventId = `evt-replay-${Date.now()}`;
        const idemKey = `idem-replay-${Date.now()}`;

        const replayInsert = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: eventId,
            idempotency_key: idemKey,
            type: 'project.log_added',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'project',
            payload: { projectId: 'p-1', actorId: 'u-1' },
            entityType: 'project',
            entityId: 'p-1'
        });

        const replayAgain = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: eventId,
            idempotency_key: idemKey,
            type: 'project.log_added',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'project',
            payload: { projectId: 'p-1', actorId: 'u-1' },
            entityType: 'project',
            entityId: 'p-1'
        });

        const workerRetry = recordDomainEvent({
            workspace_id: workspaceId,
            event_id: `evt-retry-${Date.now()}`,
            idempotency_key: idemKey,
            type: 'project.log_added',
            version: 1,
            occurred_at: new Date().toISOString(),
            source: 'project',
            payload: { projectId: 'p-1', actorId: 'u-1' },
            entityType: 'project',
            entityId: 'p-1'
        });

        expect(replayInsert.deduplicated).toBe(false);
        expect(replayAgain.deduplicated).toBe(true);
        expect(workerRetry.deduplicated).toBe(true);
        expect(replayAgain.eventUid).toBe(replayInsert.eventUid);
        expect(workerRetry.eventUid).toBe(replayInsert.eventUid);
    });
});

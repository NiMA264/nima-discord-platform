import { describe, expect, it } from 'vitest';

const schemaModule = await import('../src/domain/events/eventEnvelopeSchema.js');
const { validateEventEnvelope } = schemaModule.default || schemaModule;

describe('event envelope schema', () => {
    it('accepts valid envelope', () => {
        const result = validateEventEnvelope({
            event_id: 'evt-1',
            idempotency_key: 'idem-1',
            type: 'github.push',
            version: 1,
            occurred_at: '2026-05-13T09:00:00.000Z',
            workspace_id: 'default-workspace',
            source: 'github',
            payload: { hello: 'world' }
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects invalid core fields', () => {
        const result = validateEventEnvelope({
            event_id: '',
            idempotency_key: '',
            type: '',
            version: 0,
            occurred_at: 'bad-date',
            workspace_id: '',
            source: '',
            payload: null
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('event_id must be a non-empty string');
        expect(result.errors).toContain('idempotency_key must be a non-empty string');
        expect(result.errors).toContain('type must be a non-empty string');
        expect(result.errors).toContain('version must be an integer >= 1');
        expect(result.errors).toContain('occurred_at must be an ISO-8601 UTC datetime string');
        expect(result.errors).toContain('workspace_id must be a non-empty string');
        expect(result.errors).toContain('source must be a non-empty string');
        expect(result.errors).toContain('payload must be an object');
    });
});

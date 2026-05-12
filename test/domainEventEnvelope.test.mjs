import { describe, expect, it } from 'vitest';

const validatorModule = await import('../src/domain/events/validateDomainEventEnvelope.js');
const { validateDomainEventEnvelope } = validatorModule.default || validatorModule;

describe('validateDomainEventEnvelope', () => {
    it('accepts a valid v1 github.push envelope', () => {
        const result = validateDomainEventEnvelope({
            eventId: 'evt-1',
            eventType: 'github.push',
            eventVersion: 1,
            occurredAt: '2026-05-12T10:00:00.000Z',
            source: 'github',
            payload: {
                deliveryId: 'd-1',
                repositoryFullName: 'org/repo',
                sender: 'dev',
                ref: 'refs/heads/main',
                url: 'https://github.com/org/repo/compare/main'
            }
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects unknown event types', () => {
        const result = validateDomainEventEnvelope({
            eventId: 'evt-2',
            eventType: 'github.unknown',
            eventVersion: 1,
            occurredAt: '2026-05-12T10:00:00.000Z',
            source: 'github',
            payload: {}
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some(err => err.includes('eventType is unknown'))).toBe(true);
    });

    it('rejects invalid core envelope fields', () => {
        const result = validateDomainEventEnvelope({
            eventId: '',
            eventType: 'github.push',
            eventVersion: 0,
            occurredAt: 'not-a-date',
            source: '',
            payload: null
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('eventId is required and must be a non-empty string');
        expect(result.errors).toContain('eventVersion is required and must be an integer >= 1');
        expect(result.errors).toContain('occurredAt is required and must be an ISO-8601 UTC datetime string');
        expect(result.errors).toContain('source is required and must be a non-empty string');
        expect(result.errors).toContain('payload is required and must be an object');
    });

    it('rejects missing contract-mandatory payload fields', () => {
        const result = validateDomainEventEnvelope({
            eventId: 'evt-3',
            eventType: 'github.pull_request.opened',
            eventVersion: 1,
            occurredAt: '2026-05-12T10:00:00.000Z',
            source: 'github',
            payload: {
                deliveryId: 'd-2',
                repositoryFullName: 'org/repo',
                sender: 'dev'
            }
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some(err => err.includes('action'))).toBe(true);
        expect(result.errors.some(err => err.includes('pullRequestNumber'))).toBe(true);
        expect(result.errors.some(err => err.includes('url'))).toBe(true);
    });
});

import { describe, expect, it } from 'vitest';

const moduleRef = await import('../src/projections/validateProjectionState.js');
const { validateProjectionState } = moduleRef.default || moduleRef;

describe('validateProjectionState', () => {
    it('accepts valid github activity read model state', () => {
        const result = validateProjectionState('githubActivity', {
            readModelVersion: 1,
            activeRepositories: [
                { repositoryFullName: 'org/repo', eventCount: 3 }
            ],
            recentGithubEvents: [
                {
                    eventUid: 'evt-1',
                    type: 'github.push',
                    repositoryFullName: 'org/repo',
                    actor: 'dev',
                    url: 'https://github.com/org/repo/compare/main',
                    createdAt: '2026-05-12T10:00:00.000Z'
                }
            ],
            extraField: true
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects invalid github activity state', () => {
        const result = validateProjectionState('githubActivity', {
            readModelVersion: 2,
            activeRepositories: [
                { repositoryFullName: 'org/repo', eventCount: -1 }
            ],
            recentGithubEvents: [
                {
                    repositoryFullName: 'org/repo',
                    actor: 'dev',
                    url: 'u',
                    createdAt: 'x'
                }
            ]
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some(err => err.includes('readModelVersion'))).toBe(true);
        expect(result.errors.some(err => err.includes('eventCount'))).toBe(true);
        expect(result.errors.some(err => err.includes('type is required'))).toBe(true);
    });

    it('accepts valid contribution read model state', () => {
        const result = validateProjectionState('contribution', {
            readModelVersion: 1,
            contributionCounts: {
                push: 1,
                pullRequestsOpened: 2,
                issuesOpened: 3
            },
            debug: 'allowed'
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects invalid contribution state and unknown contracts', () => {
        const bad = validateProjectionState('contribution', {
            readModelVersion: 1,
            contributionCounts: {
                push: '1',
                pullRequestsOpened: 2
            }
        });

        expect(bad.valid).toBe(false);
        expect(bad.errors.some(err => err.includes('push must be integer'))).toBe(true);
        expect(bad.errors.some(err => err.includes('issuesOpened is required'))).toBe(true);

        const unknown = validateProjectionState('unknown', {});
        expect(unknown.valid).toBe(false);
        expect(unknown.errors[0]).toContain('unknown projection contract');
    });
});

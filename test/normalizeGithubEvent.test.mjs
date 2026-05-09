import { describe, it, expect } from 'vitest';

const { normalizeGithubEvent } = await import('../src/integrations/github/normalizeGithubEvent.js');

describe('normalizeGithubEvent', () => {
    it('normalizes push events', () => {
        const payload = {
            projectId: 'p1',
            sender: { login: 'alice' },
            ref: 'refs/heads/main',
            commits: [{ id: 'a' }, { id: 'b' }],
            compare: 'https://github.com/org/repo/compare/a...b',
            repository: { full_name: 'org/repo', updated_at: '2026-01-01T00:00:00Z' },
            head_commit: { timestamp: '2026-01-01T01:00:00Z' }
        };

        const event = normalizeGithubEvent('push', payload);
        expect(event.type).toBe('push');
        expect(event.projectId).toBe('p1');
        expect(event.actor).toBe('alice');
        expect(event.summary).toContain('2 commit(s)');
        expect(event.raw).toEqual(payload);
    });

    it('normalizes pull_request events', () => {
        const payload = {
            projectUid: 'p2',
            action: 'opened',
            sender: { login: 'bob' },
            pull_request: {
                number: 42,
                title: 'Add feature',
                html_url: 'https://github.com/org/repo/pull/42',
                created_at: '2026-01-01T00:00:00Z'
            }
        };

        const event = normalizeGithubEvent('pull_request', payload);
        expect(event.type).toBe('pull_request');
        expect(event.projectId).toBe('p2');
        expect(event.actor).toBe('bob');
        expect(event.summary).toContain('PR #42 opened');
        expect(event.raw).toEqual(payload);
    });

    it('normalizes issues events', () => {
        const payload = {
            project_id: 'p3',
            action: 'closed',
            sender: { login: 'carol' },
            issue: {
                number: 7,
                title: 'Bug fix',
                html_url: 'https://github.com/org/repo/issues/7',
                updated_at: '2026-01-01T02:00:00Z'
            }
        };

        const event = normalizeGithubEvent('issues', payload);
        expect(event.type).toBe('issue');
        expect(event.projectId).toBe('p3');
        expect(event.actor).toBe('carol');
        expect(event.summary).toContain('Issue #7 closed');
        expect(event.raw).toEqual(payload);
    });
});

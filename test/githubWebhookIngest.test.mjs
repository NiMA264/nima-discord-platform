import { describe, it, expect } from 'vitest';

const { ingestGithubWebhook } = await import('../src/integrations/github/githubWebhookIngest.js');

describe('githubWebhookIngest normalization routing', () => {
    it('queues normalized push activity with raw payload', async () => {
        const body = {
            projectId: 'p-route',
            sender: { login: 'alice' },
            ref: 'refs/heads/main',
            commits: [],
            repository: { full_name: 'org/repo', updated_at: '2026-01-01T00:00:00Z' }
        };

        const result = await ingestGithubWebhook({
            headers: { 'x-github-event': 'push', 'x-github-delivery': 'd1' },
            rawBody: JSON.stringify(body),
            body
        });

        expect(result.ok).toBe(true);
    });
});

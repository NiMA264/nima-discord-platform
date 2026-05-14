import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const githubRepositoryMappingRepositoryModule = await import('../src/repositories/githubRepositoryMappingRepository.js');
const domainEventRepositoryModule = await import('../src/repositories/domainEventRepository.js');
const githubWebhookServiceModule = await import('../src/integrations/github/githubWebhookService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const githubRepositoryMappingRepository = githubRepositoryMappingRepositoryModule.default || githubRepositoryMappingRepositoryModule;
const domainEventRepository = domainEventRepositoryModule.default || domainEventRepositoryModule;
const githubWebhookService = githubWebhookServiceModule.default || githubWebhookServiceModule;

function sign(secret, bodyText) {
    return `sha256=${crypto.createHmac('sha256', secret).update(bodyText).digest('hex')}`;
}

describe('github webhook service foundation', () => {
    it('records mapped push webhook as workspace-scoped domain event', async () => {
        const workspaceId = workspaceService.createWorkspace({
            name: `GitHub WS ${Date.now()}`,
            ownerUserId: 'u-github'
        }).workspaceId;

        githubRepositoryMappingRepository.upsertRepositoryWorkspaceMapping({
            repositoryFullName: 'org/repo-a',
            workspaceId
        });

        const payload = {
            ref: 'refs/heads/main',
            repository: { full_name: 'org/repo-a', html_url: 'https://github.com/org/repo-a' },
            sender: { login: 'octocat' }
        };
        const rawBody = JSON.stringify(payload);
        const secret = 'secret-1';

        const result = await githubWebhookService.ingestGithubWebhookSignal({
            headers: {
                'x-github-event': 'push',
                'x-github-delivery': `delivery-${Date.now()}`,
                'x-hub-signature-256': sign(secret, rawBody)
            },
            rawBody,
            body: payload,
            webhookSecret: secret
        });

        expect(result.ok).toBe(true);
        expect(result.statusCode).toBe(202);

        const events = domainEventRepository.listDomainEventsByWorkspace(workspaceId, 20);
        expect(events.some(item => item.type === 'github.push' && item.entityId === 'org/repo-a')).toBe(true);
    });

    it('ignores unsupported or unmapped webhook payloads', async () => {
        const payload = {
            action: 'closed',
            repository: { full_name: 'org/not-mapped' },
            pull_request: { number: 1 }
        };
        const result = await githubWebhookService.ingestGithubWebhookSignal({
            headers: { 'x-github-event': 'pull_request', 'x-github-delivery': `delivery-${Date.now()}` },
            rawBody: JSON.stringify(payload),
            body: payload,
            webhookSecret: ''
        });

        expect(result.ok).toBe(true);
        expect(result.statusCode).toBe(202);
        expect(result.message).toContain('unsupported');
    });

    it('deduplicates same delivery id as replay', async () => {
        const workspaceId = workspaceService.createWorkspace({
            name: `Replay WS ${Date.now()}`,
            ownerUserId: 'u-replay'
        }).workspaceId;

        githubRepositoryMappingRepository.upsertRepositoryWorkspaceMapping({
            repositoryFullName: 'org/repo-replay',
            workspaceId
        });

        const payload = {
            ref: 'refs/heads/main',
            head_commit: { timestamp: new Date().toISOString() },
            repository: { full_name: 'org/repo-replay', html_url: 'https://github.com/org/repo-replay' },
            sender: { login: 'octocat' }
        };
        const rawBody = JSON.stringify(payload);
        const secret = 'secret-replay';
        const deliveryId = `delivery-replay-${Date.now()}`;

        const first = await githubWebhookService.ingestGithubWebhookSignal({
            headers: {
                'x-github-event': 'push',
                'x-github-delivery': deliveryId,
                'x-hub-signature-256': sign(secret, rawBody)
            },
            rawBody,
            body: payload,
            webhookSecret: secret
        });
        const second = await githubWebhookService.ingestGithubWebhookSignal({
            headers: {
                'x-github-event': 'push',
                'x-github-delivery': deliveryId,
                'x-hub-signature-256': sign(secret, rawBody)
            },
            rawBody,
            body: payload,
            webhookSecret: secret
        });

        expect(first.ok).toBe(true);
        expect(first.statusCode).toBe(202);
        expect(second.ok).toBe(true);
        expect(second.statusCode).toBe(202);
        expect(second.message.toLowerCase()).toContain('replay');
    });

    it('rejects stale event timestamp even with valid signature', async () => {
        const staleDate = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)).toISOString();
        const payload = {
            ref: 'refs/heads/main',
            head_commit: { timestamp: staleDate },
            repository: { full_name: 'org/repo-stale', html_url: 'https://github.com/org/repo-stale' },
            sender: { login: 'octocat' }
        };
        const rawBody = JSON.stringify(payload);
        const secret = 'secret-stale';

        const result = await githubWebhookService.ingestGithubWebhookSignal({
            headers: {
                'x-github-event': 'push',
                'x-github-delivery': `delivery-stale-${Date.now()}`,
                'x-hub-signature-256': sign(secret, rawBody)
            },
            rawBody,
            body: payload,
            webhookSecret: secret
        });

        expect(result.ok).toBe(true);
        expect(result.statusCode).toBe(202);
        expect(result.message.toLowerCase()).toContain('replay rejected');
    });
});

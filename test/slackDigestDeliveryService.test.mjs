import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const workspaceSettingsRepositoryModule = await import('../src/repositories/workspaceSettingsRepository.js');
const slackDigestDeliveryServiceModule = await import('../src/services/slackDigestDeliveryService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const workspaceSettingsRepository = workspaceSettingsRepositoryModule.default || workspaceSettingsRepositoryModule;
const slackDigestDeliveryService = slackDigestDeliveryServiceModule.default || slackDigestDeliveryServiceModule;

describe('slack digest delivery service', () => {
    beforeEach(() => {
        global.fetch = vi.fn(async () => ({ ok: true }));
    });

    it('no-ops when webhook is not configured', async () => {
        const workspaceId = workspaceService.createWorkspace({
            name: `SlackNoWebhook-${Date.now()}`,
            ownerUserId: 'u-1'
        }).workspaceId;

        const result = await slackDigestDeliveryService.deliverWorkspaceDigestToSlack({
            guildId: 'g-no-webhook',
            workspaceId,
            digest: { workspaceId, totalSuggestions: 2, byType: [{ key: 'inactive_project', count: 2 }] }
        });

        expect(result.delivered).toBe(false);
        expect(result.reason).toBe('no_webhook_config');
    });

    it('posts digest text to configured webhook url', async () => {
        const workspaceId = workspaceService.createWorkspace({
            name: `SlackWebhook-${Date.now()}`,
            ownerUserId: 'u-2'
        }).workspaceId;
        workspaceSettingsRepository.upsertWorkspaceSlackWebhookUrl({
            workspaceId,
            slackWebhookUrl: 'https://hooks.slack.test/services/T000/B000/XXX'
        });

        const result = await slackDigestDeliveryService.deliverWorkspaceDigestToSlack({
            guildId: 'g-with-webhook',
            workspaceId,
            digest: {
                workspaceId,
                totalSuggestions: 3,
                byType: [{ key: 'stale_in_progress_task', count: 2 }]
            }
        });

        expect(result.delivered).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('hooks.slack.test');
    });
});

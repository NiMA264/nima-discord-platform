import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const workspaceSettingsRepositoryModule = await import('../src/repositories/workspaceSettingsRepository.js');
const discordDigestDeliveryServiceModule = await import('../src/services/discordDigestDeliveryService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const workspaceSettingsRepository = workspaceSettingsRepositoryModule.default || workspaceSettingsRepositoryModule;
const discordDigestDeliveryService = discordDigestDeliveryServiceModule.default || discordDigestDeliveryServiceModule;

describe('discord digest delivery service', () => {
    beforeEach(() => {
        discordDigestDeliveryService.setDiscordDigestDeliveryClient(null);
    });

    it('no-ops when no digest channel is configured', async () => {
        const workspaceId = workspaceService.createWorkspace({
            name: `NoChannel-${Date.now()}`,
            ownerUserId: 'u-1'
        }).workspaceId;

        discordDigestDeliveryService.setDiscordDigestDeliveryClient({
            channels: {
                fetch: vi.fn(async () => ({ send: vi.fn(async () => {}) }))
            }
        });

        const result = await discordDigestDeliveryService.deliverWorkspaceDigest({
            guildId: 'guild-no-channel',
            workspaceId,
            digest: { workspaceId, totalSuggestions: 2, byType: [{ key: 'inactive_project', count: 2 }], bySeverity: [] }
        });

        expect(result.delivered).toBe(false);
        expect(result.reason).toBe('no_channel_config');
    });

    it('sends digest message when channel is configured', async () => {
        const workspaceId = workspaceService.createWorkspace({
            name: `WithChannel-${Date.now()}`,
            ownerUserId: 'u-2'
        }).workspaceId;
        workspaceSettingsRepository.upsertWorkspaceDigestChannel({
            workspaceId,
            digestChannelId: 'channel-123'
        });

        const send = vi.fn(async () => {});
        const fetch = vi.fn(async () => ({ send }));
        discordDigestDeliveryService.setDiscordDigestDeliveryClient({
            channels: { fetch }
        });

        const result = await discordDigestDeliveryService.deliverWorkspaceDigest({
            guildId: 'guild-with-channel',
            workspaceId,
            digest: {
                workspaceId,
                totalSuggestions: 3,
                byType: [
                    { key: 'stale_in_progress_task', count: 2 },
                    { key: 'overloaded_assignee', count: 1 }
                ],
                bySeverity: [{ key: 'high', count: 1 }]
            }
        });

        expect(result.delivered).toBe(true);
        expect(fetch).toHaveBeenCalledWith('channel-123');
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0].content).toContain('Total suggestions: 3');
    });
});

import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const helpCommand = (await import('../src/commands/help.js')).default || (await import('../src/commands/help.js'));
const settingsRepo = await import('../src/repositories/guildSettingsRepository.js');
const projectRepo = await import('../src/repositories/projectRepository.js');

const { upsertGuildChannelSettings } = settingsRepo;
const { createProjectEntity, upsertProjectMember } = projectRepo;

initializeDatabase();

function buildInteraction({ guildId, userId, isAdmin, guild, channel }) {
    const replies = [];
    return {
        guildId,
        user: { id: userId },
        member: { permissions: { has: () => Boolean(isAdmin) } },
        guild,
        channel,
        options: { getSubcommand: () => 'publish' },
        reply: async (payload) => replies.push(payload),
        _replies: replies
    };
}

describe('/help publish', () => {
    it('posts into configured help channel id', async () => {
        const guildId = `help-guild-${Date.now()}`;
        upsertGuildChannelSettings({ guildId, helpChannelId: 'help-1' });

        const sent = [];
        const guild = {
            id: guildId,
            channels: {
                cache: new Map([
                    ['help-1', { id: 'help-1', name: 'help', type: 0, send: async (payload) => sent.push(payload), toString: () => '#help' }]
                ])
            }
        };
        const interaction = buildInteraction({
            guildId,
            userId: 'admin-1',
            isAdmin: true,
            guild,
            channel: { id: 'fallback', send: async () => {}, toString: () => '#fallback' }
        });

        await helpCommand.execute(interaction, {});
        expect(sent.length).toBe(1);
        expect(String(sent[0].content)).toContain('/setup channels');
    });

    it('falls back to current channel when help_channel_id is not set', async () => {
        const guildId = `help-guild-${Date.now()}`;
        const sent = [];
        const interaction = buildInteraction({
            guildId,
            userId: 'admin-2',
            isAdmin: true,
            guild: { id: guildId, channels: { cache: new Map() } },
            channel: { id: 'fallback', send: async (payload) => sent.push(payload), toString: () => '#fallback' }
        });

        await helpCommand.execute(interaction, {});
        expect(sent.length).toBe(1);
    });

    it('allows PROJECT_LEAD without admin permission', async () => {
        const guildId = `help-guild-${Date.now()}`;
        const userId = `user-${Date.now()}`;
        const projectUid = `help-project-${Date.now()}`;

        await createProjectEntity({
            projectUid,
            guildId,
            threadId: 'pending',
            creatorId: userId,
            name: 'Help Role Project',
            slug: `help-role-${Date.now()}`,
            description: '',
            stack: '',
            status: 'active',
            forumChannelId: null,
            createdAt: new Date().toISOString()
        });
        await upsertProjectMember({ projectUid, userId, role: 'PROJECT_LEAD' });

        const sent = [];
        const interaction = buildInteraction({
            guildId,
            userId,
            isAdmin: false,
            guild: { id: guildId, channels: { cache: new Map() } },
            channel: { id: 'fallback', send: async (payload) => sent.push(payload), toString: () => '#fallback' }
        });

        await helpCommand.execute(interaction, {});
        expect(sent.length).toBe(1);
    });
});

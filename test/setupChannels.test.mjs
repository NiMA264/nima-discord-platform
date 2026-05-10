import { describe, it, expect } from 'vitest';
import { initializeDatabase } from '../src/database/database.js';
import setupCommand from '../src/commands/setup.js';
import settingsRepo from '../src/repositories/guildSettingsRepository.js';

const { getGuildSettings } = settingsRepo;

initializeDatabase();

describe('/setup channels', () => {
    it('stores configured channel ids in guild_settings', async () => {
        const guildId = `setup-guild-${Date.now()}`;
        const replyCalls = [];

        const channels = {
            setup_category: { id: 'cat-1', name: 'Setup', type: 4 },
            welcome_channel: { id: 'txt-1', name: 'welcome', type: 0 },
            bot_channel: { id: 'txt-2', name: 'bots', type: 0 },
            help_channel: { id: 'txt-help', name: 'help', type: 0 },
            project_forum_channel: { id: 'frm-1', name: 'projects', type: 15 },
            knowledge_channel: { id: 'txt-3', name: 'knowledge', type: 0 }
        };

        const interaction = {
            guildId,
            member: {
                permissions: { has: () => true }
            },
            options: {
                getSubcommand: () => 'channels',
                getChannel: (name) => channels[name] || null
            },
            reply: async payload => {
                replyCalls.push(payload);
            }
        };

        await setupCommand.execute(interaction);
        expect(replyCalls.length).toBe(1);

        const row = getGuildSettings(guildId);
        expect(row.welcome_channel_id).toBe('txt-1');
        expect(row.bot_channel_id).toBe('txt-2');
        expect(row.help_channel_id).toBe('txt-help');
        expect(row.project_forum_channel_id).toBe('frm-1');
        expect(row.knowledge_channel_id).toBe('txt-3');
        expect(row.setup_category_id).toBe('cat-1');
    });
});

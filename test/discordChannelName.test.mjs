import { describe, it, expect } from 'vitest';
import { Collection, ChannelType } from 'discord.js';
import channelName from '../src/lib/discordChannelName.js';
import resolvers from '../src/utils/resolvers.js';

const { normalizeDiscordChannelName, channelNameMatches } = channelName;
const { findCategory, findTextChannel } = resolvers;

describe('discord channel name normalization', () => {
    it('normalizes prefixed text channel names', () => {
        expect(normalizeDiscordChannelName('├・📌-welcome')).toBe('welcome');
        expect(normalizeDiscordChannelName('└・🤖-discord-bots')).toBe('discord-bots');
    });

    it('normalizes prefixed category names', () => {
        expect(normalizeDiscordChannelName('📂 ╭・👋 START')).toBe('start');
    });

    it('matches canonical expected names', () => {
        expect(channelNameMatches('└・🤖-discord-bots', 'discord-bots')).toBe(true);
        expect(channelNameMatches('📂 ╭・👋 START', 'start')).toBe(true);
    });
});

describe('resolver integration for normalized matching', () => {
    function makeGuild(channels) {
        return {
            id: 'g-1',
            channels: {
                cache: new Collection(channels.map(ch => [ch.id, ch]))
            }
        };
    }

    it('resolves category with tree/emoji prefixes', () => {
        const guild = makeGuild([
            { id: 'c1', name: '📂 ╭・👋 START', type: ChannelType.GuildCategory },
            { id: 't1', name: '├・📌-welcome', type: ChannelType.GuildText }
        ]);

        const category = findCategory(guild, 'start');
        expect(category?.id).toBe('c1');
    });

    it('resolves text channel with prefixed name', () => {
        const guild = makeGuild([
            { id: 'c1', name: '📂 ╭・👋 START', type: ChannelType.GuildCategory },
            { id: 't1', name: '└・🤖-discord-bots', type: ChannelType.GuildText }
        ]);

        const channel = findTextChannel(guild, 'discord-bots');
        expect(channel?.id).toBe('t1');
    });

    it('prefers channel id before name fallback', () => {
        const guild = makeGuild([
            { id: 't-legacy', name: 'welcome', type: ChannelType.GuildText },
            { id: 't-config', name: 'some-random-name', type: ChannelType.GuildText }
        ]);

        const channel = findTextChannel(guild, 'welcome', 't-config');
        expect(channel?.id).toBe('t-config');
    });
});

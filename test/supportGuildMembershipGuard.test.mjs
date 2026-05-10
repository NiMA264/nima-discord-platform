import { describe, it, expect, vi } from 'vitest';
import guardModule from '../src/guards/requireSupportGuildMembership.js';
import handlerModule from '../src/events/chatCommandHandler.js';

const { supportGateConfig, requireSupportGuildMembership } = guardModule;
const { handleChatInputCommand, commandMap } = handlerModule;

function makeInteraction(overrides = {}) {
    const reply = vi.fn(async () => {});
    return {
        commandName: 'support-test',
        user: { id: 'user-1' },
        member: { permissions: { has: () => false } },
        client: {
            guilds: {
                fetch: vi.fn(async () => ({
                    members: { fetch: vi.fn(async () => ({ id: 'user-1' })) }
                }))
            }
        },
        reply,
        ...overrides
    };
}

describe('support guild membership gate', () => {
    it('disables gate when SUPPORT_GUILD_ID is missing', async () => {
        const cfg = supportGateConfig({});
        expect(cfg.enabled).toBe(false);
    });

    it('allows member when support guild lookup succeeds', async () => {
        const interaction = makeInteraction();
        const result = await requireSupportGuildMembership(interaction, {
            env: { SUPPORT_GUILD_ID: 'support-guild', SUPPORT_INVITE_URL: 'https://discord.gg/test' }
        });

        expect(result.ok).toBe(true);
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('blocks non-member with ephemeral invite message', async () => {
        const interaction = makeInteraction({
            client: {
                guilds: {
                    fetch: vi.fn(async () => ({
                        members: { fetch: vi.fn(async () => { throw new Error('not found'); }) }
                    }))
                }
            }
        });

        const result = await requireSupportGuildMembership(interaction, {
            env: { SUPPORT_GUILD_ID: 'support-guild', SUPPORT_INVITE_URL: 'https://discord.gg/test' }
        });

        expect(result.ok).toBe(false);
        expect(interaction.reply).toHaveBeenCalledTimes(1);
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            flags: 64,
            content: expect.stringContaining('https://discord.gg/test')
        }));
    });

    it('blocks command routing before command execution when user is not member', async () => {
        const execute = vi.fn(async () => {});
        commandMap['support-test'] = { execute };

        const interaction = makeInteraction({
            client: {
                guilds: {
                    fetch: vi.fn(async () => ({
                        members: { fetch: vi.fn(async () => { throw new Error('not found'); }) }
                    }))
                }
            }
        });

        const supportGuildId = process.env.SUPPORT_GUILD_ID;
        const supportInviteUrl = process.env.SUPPORT_INVITE_URL;
        process.env.SUPPORT_GUILD_ID = 'support-guild';
        process.env.SUPPORT_INVITE_URL = 'https://discord.gg/test';

        try {
            const handled = await handleChatInputCommand(interaction, {});
            expect(handled).toBe(true);
            expect(execute).not.toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledTimes(1);
        } finally {
            if (supportGuildId === undefined) delete process.env.SUPPORT_GUILD_ID;
            else process.env.SUPPORT_GUILD_ID = supportGuildId;
            if (supportInviteUrl === undefined) delete process.env.SUPPORT_INVITE_URL;
            else process.env.SUPPORT_INVITE_URL = supportInviteUrl;
            delete commandMap['support-test'];
        }
    });
});


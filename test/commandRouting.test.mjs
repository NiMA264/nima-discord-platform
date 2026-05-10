import { describe, it, expect } from 'vitest';
import handlerModule from '../src/events/chatCommandHandler.js';

const { commandMap, handleChatInputCommand } = handlerModule;

describe('chat command routing', () => {
    it('exposes MVP commands in routing map', () => {
        expect(Object.keys(commandMap)).toEqual(expect.arrayContaining([
            'setup',
            'moderation',
            'ask',
            'thread-summary',
            'knowledge',
            'dev',
            'help'
        ]));
    });

    it('returns false for unknown command', async () => {
        const handled = await handleChatInputCommand({ commandName: 'unknown' }, {});
        expect(handled).toBe(false);
    });
});

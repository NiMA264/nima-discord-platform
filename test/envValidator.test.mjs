import { describe, it, expect } from 'vitest';
import envValidator from '../src/utils/envValidator.js';

const { validateEnv, requiredKeys } = envValidator;

describe('envValidator', () => {
    it('returns ok when all required env keys are present', () => {
        const env = {
            DISCORD_TOKEN: 'token',
            DISCORD_CLIENT_ID: 'client',
            DISCORD_GUILD_ID: 'guild'
        };

        expect(validateEnv(env)).toEqual({ ok: true, missing: [] });
    });

    it('returns missing keys when required env keys are absent', () => {
        const env = {
            DISCORD_TOKEN: 'token',
            DISCORD_CLIENT_ID: '   ',
            DISCORD_GUILD_ID: ''
        };

        const result = validateEnv(env);
        expect(result.ok).toBe(false);
        expect(result.missing).toEqual(expect.arrayContaining(['DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID']));
    });

    it('tracks required key list', () => {
        expect(requiredKeys).toEqual([
            'DISCORD_TOKEN',
            'DISCORD_CLIENT_ID',
            'DISCORD_GUILD_ID'
        ]);
    });
});

import { describe, it, expect } from 'vitest';
import knowledgeRepo from '../src/repositories/knowledgeRepository.js';
import knowledgeSystem from '../src/systems/knowledgeSystem.js';

const { createKnowledgeEntry, getKnowledgeEntryById, markKnowledgeEntryAccepted, listKnowledgeEntries } = knowledgeRepo;
const { acceptKnowledgeSolution, getKnowledgeEntryDetails, unacceptKnowledgeSolution, listKnowledgeEntriesForCuration } = knowledgeSystem;

function makeInteraction({ guildId, channelId, threadId, userId, userTag, isModerator, isManageGuild }) {
    return {
        guildId,
        channelId,
        channel: {
            id: threadId || channelId,
            ownerId: 'thread-owner-1'
        },
        user: {
            id: userId,
            tag: userTag || `${userId}#0001`,
            bot: false
        },
        member: {
            permissions: {
                has() {
                    if (isManageGuild) return true;
                    if (isModerator) return true;
                    return false;
                }
            }
        },
        guild: {
            id: guildId,
            channels: { cache: new Map() },
            systemChannel: null
        }
    };
}

function createEntry(guildId, threadId, marker) {
    const insert = createKnowledgeEntry({
        guildId,
        channelId: 'channel-a',
        threadId,
        sourceMessageId: `msg-${marker}`,
        sourceType: 'message',
        title: `Accepted candidate ${marker}`,
        content: `Content ${marker}`,
        tags: 'knowledge',
        createdBy: 'user-author',
        createdAt: new Date().toISOString()
    });
    return Number(insert.lastInsertRowid);
}

describe('knowledge accept flow', () => {
    it('repository lists recent entries', () => {
        const guildId = `list-recent-${Date.now()}`;
        const e1 = createEntry(guildId, 'thread-a', `r1-${Date.now()}`);
        const e2 = createEntry(guildId, 'thread-a', `r2-${Date.now()}`);
        const rows = listKnowledgeEntries(guildId, { filter: 'recent', limit: 10 });
        expect(rows.length).toBeGreaterThanOrEqual(2);
        expect(rows[0].id).toBeGreaterThanOrEqual(rows[1].id);
        expect([e1, e2]).toContain(rows[0].id);
    });

    it('repository lists accepted entries', () => {
        const guildId = `list-accepted-${Date.now()}`;
        const idAccepted = createEntry(guildId, 'thread-a', `a1-${Date.now()}`);
        createEntry(guildId, 'thread-a', `a2-${Date.now()}`);
        markKnowledgeEntryAccepted(guildId, idAccepted, 'mod-1', new Date().toISOString());
        const rows = listKnowledgeEntries(guildId, { filter: 'accepted', limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.is_accepted_solution === 1)).toBe(true);
    });

    it('repository lists unaccepted entries', () => {
        const guildId = `list-unaccepted-${Date.now()}`;
        const idAccepted = createEntry(guildId, 'thread-a', `u1-${Date.now()}`);
        createEntry(guildId, 'thread-a', `u2-${Date.now()}`);
        markKnowledgeEntryAccepted(guildId, idAccepted, 'mod-1', new Date().toISOString());
        const rows = listKnowledgeEntries(guildId, { filter: 'unaccepted', limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.is_accepted_solution === 0)).toBe(true);
    });

    it('repository lists entries by thread', () => {
        const guildId = `list-thread-${Date.now()}`;
        const threadA = `thread-a-${Date.now()}`;
        const threadB = `thread-b-${Date.now()}`;
        createEntry(guildId, threadA, `t1-${Date.now()}`);
        createEntry(guildId, threadB, `t2-${Date.now()}`);
        const rows = listKnowledgeEntries(guildId, { filter: 'thread', threadId: threadA, limit: 10 });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.thread_id === threadA)).toBe(true);
    });

    it('repository can read entry by id', () => {
        const guildId = `repo-read-${Date.now()}`;
        const entryId = createEntry(guildId, 'thread-a', `read-${Date.now()}`);
        const row = getKnowledgeEntryById(guildId, entryId);
        expect(row).toBeTruthy();
        expect(row.id).toBe(entryId);
    });

    it('repository marks accepted solution', () => {
        const guildId = `repo-guild-${Date.now()}`;
        const entryId = createEntry(guildId, 'thread-a', `repo-${Date.now()}`);
        const acceptedAt = new Date().toISOString();
        const result = markKnowledgeEntryAccepted(guildId, entryId, 'mod-1', acceptedAt);
        expect(result.changes).toBe(1);
        const row = getKnowledgeEntryById(guildId, entryId);
        expect(row.is_accepted_solution).toBe(1);
        expect(row.accepted_by).toBe('mod-1');
        expect(row.accepted_at).toBe(acceptedAt);
    });

    it('repository unaccepts accepted solution', () => {
        const guildId = `repo-unaccept-${Date.now()}`;
        const entryId = createEntry(guildId, 'thread-a', `repo-unaccept-${Date.now()}`);
        markKnowledgeEntryAccepted(guildId, entryId, 'mod-1', new Date().toISOString());
        const result = knowledgeRepo.unacceptKnowledgeEntry(guildId, entryId);
        expect(result.changes).toBe(1);
        const row = getKnowledgeEntryById(guildId, entryId);
        expect(row.is_accepted_solution).toBe(0);
        expect(row.accepted_by).toBeNull();
        expect(row.accepted_at).toBeNull();
    });

    it('accepts existing entry via system', async () => {
        const guildId = `sys-guild-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `sys-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        const result = await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId, reason: 'valid fix' });
        expect(result.ok).toBe(true);
        expect(result.code).toBe('accepted');
    });

    it('returns not found for missing entry', async () => {
        const interaction = makeInteraction({
            guildId: `missing-guild-${Date.now()}`,
            channelId: 'channel-a',
            threadId: 'thread-a',
            userId: 'mod-user',
            isModerator: true
        });
        const result = await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId: 99999999 });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('not-found');
    });

    it('shows existing entry', () => {
        const guildId = `show-guild-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `show-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        const result = getKnowledgeEntryDetails(interaction, { entryId });
        expect(result.ok).toBe(true);
        expect(result.message).toContain(`Entry ID: ${entryId}`);
    });

    it('accept parses KNW-style ids', async () => {
        const guildId = `knw-parse-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `knw-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        const result = await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId: `KNW-${String(entryId).padStart(6, '0')}` });
        expect(result.ok).toBe(true);
        expect(result.code).toBe('accepted');
    });

    it('show returns not found for missing entry', () => {
        const interaction = makeInteraction({
            guildId: `show-missing-${Date.now()}`,
            channelId: 'channel-a',
            threadId: 'thread-a',
            userId: 'mod-user',
            isModerator: true
        });
        const result = getKnowledgeEntryDetails(interaction, { entryId: 77777777 });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('not-found');
    });

    it('handles already accepted entry idempotently', async () => {
        const guildId = `idem-guild-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `idem-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId, reason: 'first' });
        const second = await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId, reason: 'second' });
        expect(second.ok).toBe(true);
        expect(second.code).toBe('already-accepted');
    });

    it('allows moderator permission', async () => {
        const guildId = `perm-guild-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `perm-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        const result = await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId });
        expect(result.ok).toBe(true);
    });

    it('unaccepts accepted entry', async () => {
        const guildId = `unaccept-guild-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `unaccept-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId, reason: 'before unaccept' });
        const result = await unacceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId, reason: 'cleanup' });
        expect(result.ok).toBe(true);
        expect(result.code).toBe('unaccepted');
    });

    it('unaccept handles already-unaccepted idempotently', async () => {
        const guildId = `unaccept-idem-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `unaccept-idem-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'mod-user',
            isModerator: true
        });
        const result = await unacceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId, reason: 'already off' });
        expect(result.ok).toBe(true);
        expect(result.code).toBe('already-unaccepted');
    });

    it('denies unauthorized user', async () => {
        const guildId = `deny-guild-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `deny-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'normal-user',
            isModerator: false,
            isManageGuild: false
        });
        const result = await acceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('permission-denied');
    });

    it('denies unauthorized user for unaccept', async () => {
        const guildId = `deny-unaccept-${Date.now()}`;
        const threadId = `thread-${Date.now()}`;
        const entryId = createEntry(guildId, threadId, `deny-unaccept-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'normal-user',
            isModerator: false,
            isManageGuild: false
        });
        const result = await unacceptKnowledgeSolution(interaction, { channels: { channels: {} } }, { entryId });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('permission-denied');
    });

    it('system allows moderator to list knowledge', () => {
        const guildId = `sys-list-mod-${Date.now()}`;
        createEntry(guildId, `thread-${Date.now()}`, `lm-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId: 'thread-any',
            userId: 'mod-user',
            isModerator: true
        });
        interaction.channel.isThread = () => false;
        const result = listKnowledgeEntriesForCuration(interaction, { filter: 'recent', limit: 10 });
        expect(result.ok).toBe(true);
        expect(typeof result.total).toBe('number');
        expect(typeof result.shown).toBe('number');
    });

    it('system allows thread owner to list thread entries', () => {
        const guildId = `sys-list-owner-${Date.now()}`;
        const threadId = `thread-owner-${Date.now()}`;
        createEntry(guildId, threadId, `lo-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId,
            userId: 'thread-owner-1',
            isModerator: false,
            isManageGuild: false
        });
        interaction.channel.ownerId = 'thread-owner-1';
        interaction.channel.isThread = () => true;
        const result = listKnowledgeEntriesForCuration(interaction, { filter: 'thread', limit: 10 });
        expect(result.ok).toBe(true);
    });

    it('system denies unauthorized user for list', () => {
        const guildId = `sys-list-deny-${Date.now()}`;
        createEntry(guildId, `thread-${Date.now()}`, `ld-${Date.now()}`);
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId: 'thread-any',
            userId: 'normal-user',
            isModerator: false,
            isManageGuild: false
        });
        interaction.channel.isThread = () => false;
        const result = listKnowledgeEntriesForCuration(interaction, { filter: 'recent', limit: 10 });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('permission-denied');
    });

    it('system returns clear error for thread filter outside thread', () => {
        const guildId = `sys-list-thread-out-${Date.now()}`;
        const interaction = makeInteraction({
            guildId,
            channelId: 'channel-a',
            threadId: 'thread-any',
            userId: 'mod-user',
            isModerator: true
        });
        interaction.channel.isThread = () => false;
        const result = listKnowledgeEntriesForCuration(interaction, { filter: 'thread', limit: 10 });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('thread-required');
    });
});

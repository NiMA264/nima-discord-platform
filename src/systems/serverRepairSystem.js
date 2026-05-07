const { ChannelType } = require('discord.js');
const { getNameVariants } = require('../utils/resolvers');
const { scoped } = require('../utils/logger');

const repairLog = scoped('SERVER_REPAIR');
const dryRunCache = new Map();
const selectionCache = new Map();
const DRY_RUN_TTL_MS = 10 * 60 * 1000;
const SELECTION_TTL_MS = 10 * 60 * 1000;

function selectionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function isManagedChannel(channel) {
    return Boolean(channel && channel.topic && channel.topic.includes('nima-managed:true'));
}

function isProtectedChannelName(name, config) {
    const protectedNames = new Set([
        config.channels.channels.tickets,
        config.channels.channels.projectsForum,
        'community-chat'
    ]);

    const nameVariants = getNameVariants(name);
    for (const protectedName of protectedNames) {
        const protectedVariants = getNameVariants(protectedName);
        for (const variant of nameVariants) {
            if (protectedVariants.has(variant)) return true;
        }
    }

    return false;
}

function isExpectedSystemChannelName(name, config) {
    const expectedNames = expectedChannelDefs(config)
        .filter(def => def.type === ChannelType.GuildText)
        .map(def => def.name);
    const actualVariants = getNameVariants(name);

    for (const expectedName of expectedNames) {
        const expectedVariants = getNameVariants(expectedName);
        for (const actualVariant of actualVariants) {
            if (expectedVariants.has(actualVariant)) return true;
        }
    }

    return false;
}

function hasCanonicalSibling(channel, guild, config) {
    if (!channel) return false;
    const allChannels = Array.from(guild.channels.cache.values());
    const actualVariants = getNameVariants(channel.name);

    for (const def of expectedChannelDefs(config)) {
        if (def.type !== ChannelType.GuildText) continue;
        const expectedVariants = getNameVariants(def.name);
        const matchesName = Array.from(actualVariants).some(variant => expectedVariants.has(variant));
        if (!matchesName) continue;

        const siblings = allChannels.filter(item => {
            if (item.id === channel.id) return false;
            if (item.type !== ChannelType.GuildText) return false;
            const itemVariants = getNameVariants(item.name);
            return Array.from(itemVariants).some(variant => expectedVariants.has(variant));
        });

        if (siblings.length > 0) return true;
    }

    return false;
}

function expectedChannelDefs(config) {
    return [
        { name: config.channels.channels.welcome, type: ChannelType.GuildText },
        { name: config.channels.channels.rules, type: ChannelType.GuildText },
        { name: config.channels.channels.announcements, type: ChannelType.GuildText },
        { name: config.channels.channels.roles, type: ChannelType.GuildText },
        { name: config.channels.channels.aiHelp, type: ChannelType.GuildText },
        { name: config.channels.channels.codingGeneral, type: ChannelType.GuildText },
        { name: config.channels.channels.javascript, type: ChannelType.GuildText },
        { name: config.channels.channels.python, type: ChannelType.GuildText },
        { name: config.channels.channels.frontend, type: ChannelType.GuildText },
        { name: config.channels.channels.backend, type: ChannelType.GuildText },
        { name: config.channels.channels.discordBots, type: ChannelType.GuildText },
        { name: config.channels.channels.projectLogs, type: ChannelType.GuildText },
        { name: config.channels.channels.collabSearch, type: ChannelType.GuildText },
        { name: config.channels.channels.openTickets, type: ChannelType.GuildText },
        { name: config.channels.channels.chat, type: ChannelType.GuildText },
        { name: config.channels.channels.design, type: ChannelType.GuildText },
        { name: config.channels.channels.resources, type: ChannelType.GuildText },
        { name: config.channels.channels.wins, type: ChannelType.GuildText },
        { name: config.channels.channels.modLogs, type: ChannelType.GuildText },
        { name: config.channels.channels.ticketLogs, type: ChannelType.GuildText },
        { name: config.channels.channels.joinLeave, type: ChannelType.GuildText },
        { name: config.channels.channels.aiLogs, type: ChannelType.GuildText },
        { name: config.channels.channels.projectsForum, type: ChannelType.GuildForum },
        { name: config.channels.channels.tickets, type: ChannelType.GuildText }
    ];
}

function findMatchesByName(channels, expectedName, expectedType) {
    const expectedVariants = getNameVariants(expectedName);

    return channels.filter(channel => {
        if (expectedType && channel.type !== expectedType) return false;
        for (const variant of getNameVariants(channel.name)) {
            if (expectedVariants.has(variant)) return true;
        }

        return false;
    });
}

function chooseCanonicalChannel(matches) {
    const managed = matches.find(isManagedChannel);
    if (managed) return managed;
    return matches[0] || null;
}

function channelMeta(channel) {
    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        categoryId: channel.parentId || null,
        hasMessages: Boolean(channel.lastMessageId),
        lastMessageId: channel.lastMessageId || null,
        managed: isManagedChannel(channel)
    };
}

function isSafeToDeleteChannel(channel, canonical, config) {
    if (!channel || !canonical) return { safe: false, reason: 'missing-context' };
    if (channel.id === canonical.id) return { safe: false, reason: 'is-canonical' };
    if (channel.type === ChannelType.GuildForum) return { safe: false, reason: 'forum-protected' };
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildCategory) return { safe: false, reason: 'unsupported-type' };
    if (isProtectedChannelName(channel.name, config)) return { safe: false, reason: 'protected-channel-name' };
    if (channel.lastMessageId) return { safe: false, reason: 'has-messages' };

    if (isManagedChannel(channel)) return { safe: true, reason: 'managed-empty-duplicate' };

    const exactExpected = channel.name === canonical.name;
    if (exactExpected && isManagedChannel(canonical)) return { safe: true, reason: 'empty-exact-name-with-managed-canonical' };

    return { safe: false, reason: 'not-managed-or-unknown-topic' };
}

function analyzeDuplicates(guild, config) {
    const allChannels = Array.from(guild.channels.cache.values());
    const duplicateChannels = [];
    const movableChannels = [];
    const duplicateCategories = [];
    const skippedUnsafe = [];

    const defs = expectedChannelDefs(config);

    for (const def of defs) {
        const matches = findMatchesByName(allChannels, def.name, def.type);
        if (matches.length <= 1) continue;

        const canonical = chooseCanonicalChannel(matches);
        for (const channel of matches) {
            if (channel.id === canonical.id) continue;

            if (channel.parentId && canonical.parentId && channel.parentId !== canonical.parentId) {
                movableChannels.push({
                    channel: channelMeta(channel),
                    fromParentId: channel.parentId,
                    toParentId: canonical.parentId,
                    reason: 'category-mismatch'
                });
            }

            const safety = isSafeToDeleteChannel(channel, canonical, config);
            if (safety.safe) {
                duplicateChannels.push({
                    channel: channelMeta(channel),
                    canonical: channelMeta(canonical),
                    reason: safety.reason
                });
            } else {
                skippedUnsafe.push({
                    type: 'channel',
                    channel: channelMeta(channel),
                    reason: safety.reason
                });
            }
        }
    }

    for (const categoryName of Object.values(config.channels.categories)) {
        const categoryMatches = findMatchesByName(
            allChannels.filter(ch => ch.type === ChannelType.GuildCategory),
            categoryName,
            ChannelType.GuildCategory
        );

        if (categoryMatches.length <= 1) continue;

        const canonical = categoryMatches[0];
        for (const category of categoryMatches) {
            if (category.id === canonical.id) continue;

            const childChannels = allChannels.filter(ch => ch.parentId === category.id);
            const manualChildren = [];

            for (const child of childChannels) {
                const shouldMove = isManagedChannel(child) || defs.some(def => {
                    const variants = getNameVariants(def.name);
                    for (const actual of getNameVariants(child.name)) {
                        if (variants.has(actual)) return true;
                    }
                    return false;
                });

                if (shouldMove) {
                    movableChannels.push({
                        channel: channelMeta(child),
                        fromParentId: category.id,
                        toParentId: canonical.id,
                        reason: 'duplicate-category-migration'
                    });
                } else {
                    manualChildren.push(child);
                    skippedUnsafe.push({
                        type: 'channel',
                        channel: channelMeta(child),
                        reason: 'manual-or-unknown-under-duplicate-category'
                    });
                }
            }

            if (manualChildren.length === 0) {
                duplicateCategories.push({
                    category: channelMeta(category),
                    canonicalCategory: channelMeta(canonical),
                    reason: 'empty-after-safe-migration'
                });
            } else {
                skippedUnsafe.push({
                    type: 'category',
                    category: channelMeta(category),
                    reason: 'contains-manual-or-unsafe-channels'
                });
            }
        }
    }

    return { duplicateCategories, duplicateChannels, movableChannels, skippedUnsafe };
}

function buildCleanupOptions(report, limit = 25) {
    const options = [];

    for (const item of report.duplicateChannels) {
        if (options.length >= limit) break;
        const channel = item.channel;
        if (channel.hasMessages) continue;
        if (channel.type === ChannelType.GuildForum) continue;

        options.push({
            label: `Channel: ${channel.name}`.slice(0, 100),
            value: `channel:${channel.id}`,
            description: `${item.reason} | id:${channel.id}`.slice(0, 100)
        });
    }

    for (const item of report.duplicateCategories) {
        if (options.length >= limit) break;
        options.push({
            label: `Kategorie: ${item.category.name}`.slice(0, 100),
            value: `category:${item.category.id}`,
            description: `leer nach Migration | id:${item.category.id}`.slice(0, 100)
        });
    }

    return options;
}

function buildDetailedCleanupReport(report, dryRun) {
    const lines = [];
    lines.push(dryRun ? 'Cleanup Dry-Run Report' : 'Cleanup Execute Report');
    lines.push(`Würde/Löschte Kategorien: ${report.duplicateCategories.length}`);
    lines.push(`Würde/Löschte Channels: ${report.duplicateChannels.length}`);
    lines.push(`Würde/Verschob Channels: ${report.movableChannels.length}`);
    lines.push(`Safety-Übersprungen: ${report.skippedUnsafe.length}`);
    lines.push('');

    for (const item of report.skippedUnsafe.slice(0, 20)) {
        const target = item.channel || item.category;
        lines.push(`- ${item.type.toUpperCase()} ${target.name} (${target.id}) | reason=${item.reason} | hasMessages=${target.hasMessages || false} | managed=${target.managed || false}`);
    }

    return lines.join('\n');
}

function cacheDryRun(guildId, report) {
    dryRunCache.set(guildId, {
        report,
        at: Date.now()
    });
}

function hasFreshDryRun(guildId) {
    const entry = dryRunCache.get(guildId);
    if (!entry) return false;
    return Date.now() - entry.at <= DRY_RUN_TTL_MS;
}

function setAdminSelection(guildId, userId, selectedValues) {
    selectionCache.set(selectionKey(guildId, userId), {
        selectedValues,
        at: Date.now()
    });
}

function getAdminSelection(guildId, userId) {
    const entry = selectionCache.get(selectionKey(guildId, userId));
    if (!entry) return null;
    if (Date.now() - entry.at > SELECTION_TTL_MS) {
        selectionCache.delete(selectionKey(guildId, userId));
        return null;
    }

    return entry;
}

function clearAdminSelection(guildId, userId) {
    selectionCache.delete(selectionKey(guildId, userId));
}

async function cleanupDuplicateStructure(guild, config, options = { dryRun: true }) {
    const dryRun = options.dryRun !== false;
    const report = analyzeDuplicates(guild, config);

    if (dryRun) {
        cacheDryRun(guild.id, report);
        return { ok: true, dryRun: true, report, options: buildCleanupOptions(report), detailedReport: buildDetailedCleanupReport(report, true) };
    }

    if (!hasFreshDryRun(guild.id)) {
        return { ok: false, dryRun: false, requiresDryRun: true, report, options: buildCleanupOptions(report), detailedReport: buildDetailedCleanupReport(report, false) };
    }

    return { ok: true, dryRun: false, report, options: buildCleanupOptions(report), detailedReport: buildDetailedCleanupReport(report, false) };
}

function parseSelectionValues(values = []) {
    const channels = [];
    const categories = [];

    for (const value of values) {
        if (value.startsWith('channel:')) {
            channels.push(value.replace('channel:', ''));
            continue;
        }

        if (value.startsWith('category:')) {
            categories.push(value.replace('category:', ''));
        }
    }

    return { channels, categories };
}

async function executeSelectedCleanup(guild, config, selectedValues) {
    const parsed = parseSelectionValues(selectedValues);
    const deleted = { channels: [], categories: [] };
    const skipped = [];

    for (const channelId of parsed.channels) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            skipped.push({ type: 'channel', id: channelId, reason: 'not-found' });
            continue;
        }

        if (channel.type !== ChannelType.GuildText) {
            skipped.push({ type: 'channel', id: channelId, reason: 'only-textchannels-allowed' });
            continue;
        }

        if (channel.type === ChannelType.GuildForum) {
            skipped.push({ type: 'channel', id: channelId, reason: 'forum-protected' });
            continue;
        }

        if (isProtectedChannelName(channel.name, config)) {
            skipped.push({ type: 'channel', id: channelId, reason: 'protected-channel-name' });
            continue;
        }

        if (channel.lastMessageId) {
            skipped.push({ type: 'channel', id: channelId, reason: 'has-messages' });
            continue;
        }

        if (!isExpectedSystemChannelName(channel.name, config)) {
            skipped.push({ type: 'channel', id: channelId, reason: 'unknown-or-non-system-name' });
            continue;
        }

        const managed = isManagedChannel(channel);
        const canonicalSiblingExists = hasCanonicalSibling(channel, guild, config);
        if (!managed && !canonicalSiblingExists) {
            skipped.push({ type: 'channel', id: channelId, reason: 'no-canonical-sibling' });
            continue;
        }

        await channel.delete('NiMa cleanup selected execute: explicit admin confirmation');
        deleted.channels.push({ id: channelId, name: channel.name });
        repairLog.info('deleted selected channel', { channelId, channelName: channel.name, managed, canonicalSiblingExists });
    }

    for (const categoryId of parsed.categories) {
        const category = guild.channels.cache.get(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory) {
            skipped.push({ type: 'category', id: categoryId, reason: 'not-found-or-wrong-type' });
            continue;
        }

        const children = guild.channels.cache.filter(ch => ch.parentId === category.id);
        if (children.size > 0) {
            skipped.push({ type: 'category', id: categoryId, reason: 'not-empty' });
            continue;
        }

        const isSystemCategory = Object.values(config.channels.categories).some(name => {
            const expectedVariants = getNameVariants(name);
            for (const variant of getNameVariants(category.name)) {
                if (expectedVariants.has(variant)) return true;
            }
            return false;
        });

        if (!isSystemCategory) {
            skipped.push({ type: 'category', id: categoryId, reason: 'not-system-category' });
            continue;
        }

        await category.delete('NiMa cleanup selected execute: explicit admin confirmation');
        deleted.categories.push({ id: categoryId, name: category.name });
        repairLog.info('deleted selected category', { categoryId, categoryName: category.name });
    }

    return { deleted, skipped };
}

async function migrateChannelsToCanonicalCategory(duplicateCategory, canonicalCategory) {
    const children = duplicateCategory.children.cache;
    for (const child of children.values()) {
        if (child.parentId !== canonicalCategory.id) {
            await child.setParent(canonicalCategory.id, { reason: 'NiMa repair: migrate from duplicate category' });
            repairLog.info('moved channel', { channelId: child.id, fromCategory: duplicateCategory.id, toCategory: canonicalCategory.id });
        }
    }
}

async function removeDuplicateCategories(guild, config) {
    const result = await cleanupDuplicateStructure(guild, config, { dryRun: false });
    return result;
}

async function removeDuplicateChannels(guild, config) {
    const result = await cleanupDuplicateStructure(guild, config, { dryRun: false });
    return result;
}

async function repairChannelPermissions(channel, permissionOverwrites) {
    if (!permissionOverwrites || !permissionOverwrites.length) return;

    await channel.permissionOverwrites.set(permissionOverwrites, 'NiMa repair: sync channel permissions');
    repairLog.info('repaired permissions', { channelId: channel.id });
}

module.exports = {
    analyzeDuplicates,
    cleanupDuplicateStructure,
    buildCleanupOptions,
    buildDetailedCleanupReport,
    setAdminSelection,
    getAdminSelection,
    clearAdminSelection,
    executeSelectedCleanup,
    removeDuplicateCategories,
    migrateChannelsToCanonicalCategory,
    removeDuplicateChannels,
    repairChannelPermissions,
    isManagedChannel,
    isExpectedSystemChannelName,
    hasCanonicalSibling
};

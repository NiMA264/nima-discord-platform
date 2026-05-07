const { ChannelType } = require('discord.js');
const { scoped } = require('./logger');

const resolverLog = scoped('RESOLVER');

function toCanonical(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .replace(/[ä]/g, 'a')
        .replace(/[ö]/g, 'o')
        .replace(/[ü]/g, 'u')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function expandGermanVariants(value) {
    const base = String(value || '').toLowerCase().replace(/ß/g, 'ss');
    const variants = new Set([base]);

    function pushVariant(replaced) {
        variants.add(replaced);
        variants.add(replaced.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u'));
    }

    pushVariant(base.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue'));
    pushVariant(base.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u'));

    return Array.from(variants).map(toCanonical);
}

function getNameVariants(value) {
    return new Set(expandGermanVariants(value));
}

function resolveByName(collection, expectedName) {
    if (!expectedName) return null;

    const exact = collection.find(item => item.name === expectedName);
    if (exact) return exact;

    const expectedVariants = getNameVariants(expectedName);

    for (const item of collection.values()) {
        const actualVariants = getNameVariants(item.name);
        for (const variant of actualVariants) {
            if (expectedVariants.has(variant)) {
                return item;
            }
        }
    }

    return null;
}

function findChannelByType(guild, name, expectedType, label) {
    const channel = resolveByName(guild.channels.cache, name);
    if (!channel) {
        resolverLog.warn(`${label} not found`, { guildId: guild.id, name, expectedType });
        return null;
    }

    if (channel.type !== expectedType) {
        resolverLog.warn(`${label} has wrong type`, { guildId: guild.id, name, actualType: channel.type, expectedType });
        return null;
    }

    resolverLog.info(`${label} resolved`, { guildId: guild.id, name, channelId: channel.id });
    return channel;
}

function findTextChannel(guild, name) {
    return findChannelByType(guild, name, ChannelType.GuildText, 'text-channel');
}

function findForumChannel(guild, name) {
    return findChannelByType(guild, name, ChannelType.GuildForum, 'forum-channel');
}

function findCategory(guild, name) {
    return findChannelByType(guild, name, ChannelType.GuildCategory, 'category');
}

function findRole(guild, name) {
    const role = resolveByName(guild.roles.cache, name);
    if (!role) {
        resolverLog.warn('role not found', { guildId: guild.id, name });
        return null;
    }

    resolverLog.info('role resolved', { guildId: guild.id, name, roleId: role.id });
    return role;
}

module.exports = {
    findTextChannel,
    findForumChannel,
    findCategory,
    findRole,
    getNameVariants
};

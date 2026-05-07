const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { findCategory, findForumChannel, findRole, findTextChannel } = require('../utils/resolvers');
const { scoped } = require('../utils/logger');
const { getServerBuildState, upsertServerBuildState } = require('../repositories/serverBuildStateRepository');
const { repairChannelPermissions } = require('./serverRepairSystem');

const builderLog = scoped('SERVER_BUILDER');

const BUILD_MODES = {
    BUILD_INITIAL: 'BUILD_INITIAL',
    BUILD_REPAIR: 'BUILD_REPAIR',
    BUILD_SYNC: 'BUILD_SYNC'
};

const SECTION_ORDER = ['info', 'coding', 'projects', 'support', 'community', 'logs'];

function createEmptyReport(section) {
    return {
        section,
        created: [],
        repaired: [],
        skipped: [],
        moved: [],
        errors: []
    };
}

function mergeReports(base, next) {
    base.created.push(...next.created);
    base.repaired.push(...next.repaired);
    base.skipped.push(...next.skipped);
    base.moved.push(...next.moved);
    base.errors.push(...next.errors);
    return base;
}

function pushResult(report, type, action, name, extra = {}) {
    report[action].push({ type, name, ...extra });
}

function buildManagedTopic(type, topic) {
    const lines = ['nima-managed:true', `nima-type:${type}`];
    if (topic) lines.push(topic);
    return lines.join('\n');
}

async function ensureRole(guild, name) {
    const existing = findRole(guild, name);
    if (existing) return existing;
    const created = await guild.roles.create({ name, reason: 'NiMa build: missing role' });
    builderLog.info('created missing role', { roleId: created.id, name });
    return created;
}

async function ensureCategory(guild, name, report) {
    const existing = findCategory(guild, name);
    if (existing) {
        pushResult(report, 'category', 'skipped', name, { id: existing.id });
        return existing;
    }

    const created = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        reason: 'NiMa build: missing category'
    });
    pushResult(report, 'category', 'created', name, { id: created.id });
    return created;
}

async function ensureTextChannel(guild, category, name, nimaType, topic, permissionOverwrites, report) {
    const managedTopic = buildManagedTopic(nimaType, topic);
    const existing = findTextChannel(guild, name);

    if (existing) {
        let changed = false;
        if (existing.parentId !== category.id) {
            await existing.setParent(category.id, { reason: 'NiMa repair: move channel to canonical category' });
            changed = true;
            pushResult(report, 'channel', 'moved', name, { id: existing.id, toCategory: category.name });
        }

        if ((existing.topic || '') !== managedTopic) {
            await existing.setTopic(managedTopic, 'NiMa repair: sync managed topic metadata');
            changed = true;
        }

        await repairChannelPermissions(existing, permissionOverwrites || []);
        pushResult(report, 'channel', changed ? 'repaired' : 'skipped', name, { id: existing.id });
        return existing;
    }

    const created = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        topic: managedTopic,
        parent: category.id,
        permissionOverwrites,
        reason: 'NiMa build: missing text channel'
    });

    pushResult(report, 'channel', 'created', name, { id: created.id });
    return created;
}

async function ensureForum(guild, category, name, permissionOverwrites, report) {
    const existing = findForumChannel(guild, name);

    if (existing) {
        let changed = false;
        if (existing.parentId !== category.id) {
            await existing.setParent(category.id, { reason: 'NiMa repair: move forum to canonical category' });
            changed = true;
            pushResult(report, 'forum', 'moved', name, { id: existing.id, toCategory: category.name });
        }

        if (permissionOverwrites && permissionOverwrites.length) {
            await repairChannelPermissions(existing, permissionOverwrites);
            changed = true;
        }

        pushResult(report, 'forum', changed ? 'repaired' : 'skipped', name, { id: existing.id });
        return existing;
    }

    const created = await guild.channels.create({
        name,
        type: ChannelType.GuildForum,
        parent: category.id,
        permissionOverwrites,
        reason: 'NiMa build: missing forum'
    });

    pushResult(report, 'forum', 'created', name, { id: created.id });
    return created;
}

function permissionsForLogs(guild, adminRole, supportRole) {
    return [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
    ];
}

function permissionsForSupport(guild, adminRole, supportRole) {
    return [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ];
}

function permissionsForMembers(guild, memberRole) {
    return [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ];
}

async function buildInfoSection(guild, config, report) {
    const category = await ensureCategory(guild, config.channels.categories.info, report);
    await ensureTextChannel(guild, category, config.channels.channels.welcome, 'welcome', 'Welcome channel', [], report);
    await ensureTextChannel(guild, category, config.channels.channels.rules, 'rules', 'Community Regeln', [], report);
    await ensureTextChannel(guild, category, config.channels.channels.announcements, 'announcements', 'Ankuendigungen', [], report);
    await ensureTextChannel(guild, category, config.channels.channels.roles, 'roles', 'Self roles', [], report);
}

async function buildCodingSection(guild, config, report, memberRole) {
    const category = await ensureCategory(guild, config.channels.categories.coding, report);
    const memberPerms = permissionsForMembers(guild, memberRole);
    await ensureTextChannel(guild, category, config.channels.channels.aiHelp, 'ai-help', 'AI Hilfe und Mentor Support', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.codingGeneral, 'coding-general', 'Coding General', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.javascript, 'javascript', 'JavaScript Hilfe', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.python, 'python', 'Python Hilfe', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.frontend, 'frontend', 'Frontend Themen', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.backend, 'backend', 'Backend Themen', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.discordBots, 'discord-bots', 'Discord Bot Themen', memberPerms, report);
}

async function buildProjectsSection(guild, config, report, memberRole) {
    const category = await ensureCategory(guild, config.channels.categories.projects, report);
    const memberPerms = permissionsForMembers(guild, memberRole);
    await ensureForum(guild, category, config.channels.channels.projectsForum, memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.projectLogs, 'project-logs', 'Project progress logs', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.collabSearch, 'collab-search', 'Team und Collab Suche', memberPerms, report);
}

async function buildSupportSection(guild, config, report, adminRole, supportRole) {
    const category = await ensureCategory(guild, config.channels.categories.support, report);
    const supportPerms = permissionsForSupport(guild, adminRole, supportRole);
    await ensureTextChannel(guild, category, config.channels.channels.tickets, 'tickets', 'Ticket panel', supportPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.openTickets, 'open-tickets', 'Offene Tickets Uebersicht', supportPerms, report);
}

async function buildCommunitySection(guild, config, report, memberRole) {
    const category = await ensureCategory(guild, config.channels.categories.community, report);
    const memberPerms = permissionsForMembers(guild, memberRole);
    await ensureTextChannel(guild, category, config.channels.channels.chat, 'chat', 'Allgemeiner Chat', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.design, 'design', 'Design und UI', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.resources, 'resources', 'Ressourcen und Links', memberPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.wins, 'wins', 'Erfolge und Milestones', memberPerms, report);
}

async function buildLogsSection(guild, config, report, adminRole, supportRole) {
    const category = await ensureCategory(guild, config.channels.categories.logs, report);
    const logPerms = permissionsForLogs(guild, adminRole, supportRole);
    await ensureTextChannel(guild, category, config.channels.channels.modLogs, 'mod-logs', 'Moderation logs', logPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.ticketLogs, 'ticket-logs', 'Ticket logs', logPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.joinLeave, 'join-leave', 'Join Leave logs', logPerms, report);
    await ensureTextChannel(guild, category, config.channels.channels.aiLogs, 'ai-logs', 'AI logs', logPerms, report);
}

async function buildServerSection(guild, config, section) {
    const report = createEmptyReport(section);

    const adminRole = await ensureRole(guild, config.roles.admin);
    const supportRole = await ensureRole(guild, config.roles.support);
    const memberRole = await ensureRole(guild, config.roles.member);
    await ensureRole(guild, config.roles.coder);
    await ensureRole(guild, config.roles.projectLead);

    try {
        if (section === 'all') {
            for (const part of SECTION_ORDER) {
                const partReport = await buildServerSection(guild, config, part);
                mergeReports(report, partReport);
            }
            report.section = 'all';
            return report;
        }

        if (section === 'info') await buildInfoSection(guild, config, report);
        else if (section === 'coding') await buildCodingSection(guild, config, report, memberRole);
        else if (section === 'projects') await buildProjectsSection(guild, config, report, memberRole);
        else if (section === 'support') await buildSupportSection(guild, config, report, adminRole, supportRole);
        else if (section === 'community') await buildCommunitySection(guild, config, report, memberRole);
        else if (section === 'logs') await buildLogsSection(guild, config, report, adminRole, supportRole);
        else report.errors.push({ type: 'section', name: section, reason: 'unknown-section' });
    } catch (error) {
        report.errors.push({ type: 'section', name: section, reason: error.message });
        builderLog.error('section build failed', { guildId: guild.id, section, error: error.message });
    }

    return report;
}

function formatLines(items) {
    if (!items.length) return '- keine';
    return items.slice(0, 25).map(item => `- ${item.type}: ${item.name}`).join('\n');
}

function createBuildReportEmbed(report, config, section) {
    return new EmbedBuilder()
        .setTitle('Server Builder Report')
        .setColor(report.errors.length ? config.theme.errorColor : config.theme.successColor)
        .setDescription(`Bereich: **${section}**`)
        .addFields(
            { name: 'Erstellt', value: `${report.created.length}\n${formatLines(report.created)}` },
            { name: 'Repariert', value: `${report.repaired.length}\n${formatLines(report.repaired)}` },
            { name: 'Übersprungen', value: `${report.skipped.length}\n${formatLines(report.skipped)}` },
            { name: 'Verschoben', value: `${report.moved.length}\n${formatLines(report.moved)}` },
            { name: 'Fehler', value: report.errors.length ? report.errors.map(item => `- ${item.name}: ${item.reason}`).join('\n').slice(0, 1024) : '- keine' }
        )
        .setTimestamp();
}

async function buildServer(guild, config) {
    const state = getServerBuildState(guild.id);
    const mode = !state ? BUILD_MODES.BUILD_INITIAL : BUILD_MODES.BUILD_REPAIR;
    builderLog.info('build run started', { guildId: guild.id, mode });

    const report = await buildServerSection(guild, config, 'all');
    upsertServerBuildState(guild.id);

    builderLog.info('build run completed', {
        guildId: guild.id,
        mode,
        syncMode: BUILD_MODES.BUILD_SYNC,
        created: report.created.length,
        repaired: report.repaired.length,
        moved: report.moved.length,
        errors: report.errors.length
    });

    report.mode = mode;
    return report;
}

module.exports = { buildServer, buildServerSection, createBuildReportEmbed, BUILD_MODES };


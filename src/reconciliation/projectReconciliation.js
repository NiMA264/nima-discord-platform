const { ChannelType } = require('discord.js');
const { listProjectsByGuild } = require('../repositories/projectRepository');

function toIssue(type, project, details = {}) {
    return {
        type,
        projectId: project.project_uid,
        projectName: project.name,
        details
    };
}

async function evaluateProject(guild, project) {
    const issues = [];

    const forumChannel = project.forum_channel_id
        ? guild.channels.cache.get(project.forum_channel_id) || await guild.channels.fetch(project.forum_channel_id).catch(() => null)
        : null;

    if (!forumChannel) {
        issues.push(toIssue('missing_forum_channel', project, { forumChannelId: project.forum_channel_id || null }));
    }

    const thread = project.thread_id && project.thread_id !== 'pending'
        ? guild.channels.cache.get(project.thread_id) || await guild.channels.fetch(project.thread_id).catch(() => null)
        : null;

    if (!project.thread_id || project.thread_id === 'pending' || !thread) {
        issues.push(toIssue('missing_thread', project, { threadId: project.thread_id || null }));
    } else {
        if (thread.type !== ChannelType.PublicThread) {
            issues.push(toIssue('invalid_thread_type', project, { threadId: thread.id, threadType: thread.type }));
        }

        if (thread.name !== project.name) {
            issues.push(toIssue('name_drift', project, { dbName: project.name, discordName: thread.name, threadId: thread.id }));
        }
    }

    if ((!forumChannel || !thread) && project.status !== 'archived') {
        issues.push(toIssue('orphan_db_project', project, { status: project.status }));
    }

    return issues;
}

async function runProjectReconciliation(guild) {
    const projects = await listProjectsByGuild(guild.id);
    const issues = [];

    for (const project of projects) {
        const projectIssues = await evaluateProject(guild, project);
        issues.push(...projectIssues);
    }

    const grouped = issues.reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
    }, {});

    return {
        guildId: guild.id,
        scannedProjects: projects.length,
        issueCount: issues.length,
        issueSummary: grouped,
        issues
    };
}

module.exports = {
    runProjectReconciliation
};

const { ChannelType } = require('discord.js');
const { createProjectModal, createProjectLogModal } = require('../components/modals/projectModal');
const { createSetupProjectsRow } = require('../components/buttons/setupButtons');
const { createEmbed } = require('../utils/embed');
const { safeReply } = require('../utils/discord');
const { findForumChannel, findTextChannel } = require('../utils/resolvers');
const { createProjectLog, findProjectByName } = require('../repositories/projectRepository');
const { createProject, setDiscordThread } = require('../services/projectService');
const { requireProjectRole } = require('../permissions/requireProjectRole');
const { ProjectRole } = require('../domain/projectRole');

function projectTemplate(projectUid, name, description, stack, status, type) {
    return [
        `## Project: ${name}`,
        `ID: ${projectUid}`,
        '',
        '### Overview',
        description,
        '',
        '---',
        '',
        '### Tech Stack',
        stack || 'Not defined yet.',
        '',
        '---',
        '',
        '### Status',
        status,
        '',
        '### Type',
        type,
        '',
        '### Dev Log',
        `#### ${new Date().toLocaleDateString('de-DE')}`,
        '- Project created.'
    ].join('\n');
}

async function postProjectPanel(guild, config) {
    const channel = findTextChannel(guild, config.channels.channels.projectLogs);
    if (!channel) return;

    await channel.send({
        embeds: [createEmbed('Projektverwaltung', 'Erstelle Projekte und Logs über die Buttons.')],
        components: [createSetupProjectsRow()]
    });
}

function openProjectCreateModal(interaction) {
    return interaction.showModal(createProjectModal());
}

function openProjectLogModal(interaction) {
    return interaction.showModal(createProjectLogModal());
}

async function createProjectFromModal(interaction, config) {
    const name = interaction.fields.getTextInputValue('project_name');
    const description = interaction.fields.getTextInputValue('project_description');
    const status = interaction.fields.getTextInputValue('project_status');
    const type = interaction.fields.getTextInputValue('project_type');
    const stack = interaction.fields.getTextInputValue('project_stack');

    const forum = findForumChannel(interaction.guild, config.channels.channels.projectsForum);

    if (!forum) {
        return safeReply(interaction, { content: 'Projects forum not found.', flags: 64 });
    }

    const projectRecord = createProject({
        guildId: interaction.guild.id,
        creatorId: interaction.user.id,
        name,
        description,
        stack,
        status,
        type,
        forumChannelId: forum.id,
        createdAt: new Date().toISOString()
    });

    const thread = await forum.threads.create({
        name,
        message: { content: projectTemplate(projectRecord.projectUid, name, description, stack, status, type) }
    });

    setDiscordThread(projectRecord.projectUid, thread.id);

    return safeReply(interaction, { content: `Project created: ${thread}`, flags: 64 });
}

async function addProjectLogFromModal(interaction, config) {
    const projectName = interaction.fields.getTextInputValue('project_name_for_log');
    const entry = interaction.fields.getTextInputValue('project_log_entry');

    const forum = findForumChannel(interaction.guild, config.channels.channels.projectsForum);

    if (!forum) {
        return safeReply(interaction, { content: 'Projects forum not found.', flags: 64 });
    }

    const project = findProjectByName(interaction.guild.id, projectName);
    if (!project?.project_uid) {
        return safeReply(interaction, { content: `Project "${projectName}" not found in database.`, flags: 64 });
    }

    const permission = await requireProjectRole({
        interaction,
        projectId: project.project_uid,
        allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER, ProjectRole.CONTRIBUTOR, ProjectRole.REVIEWER]
    });
    if (!permission.ok) {
        return safeReply(interaction, { content: permission.reason, flags: 64 });
    }

    let thread = forum.threads.cache.find(t => t.id === project.thread_id);
    if (!thread) {
        const fetched = await forum.threads.fetchActive();
        thread = fetched.threads.find(t => t.id === project.thread_id);
    }

    if (!thread || thread.type !== ChannelType.PublicThread) {
        return safeReply(interaction, { content: `Project "${projectName}" not found.`, flags: 64 });
    }

    const logEntry = `#### ${new Date().toLocaleDateString('de-DE')}\n- ${entry}`;
    await thread.send({ content: logEntry });
    createProjectLog({
        projectUid: project.project_uid,
        source: 'DISCORD',
        eventType: 'project.log_added',
        content: {
            entry,
            userId: interaction.user.id,
            threadId: project.thread_id
        }
    });

    return safeReply(interaction, { content: `Log entry added to project "${projectName}".`, flags: 64 });
}

module.exports = {
    postProjectPanel,
    openProjectCreateModal,
    openProjectLogModal,
    createProjectFromModal,
    addProjectLogFromModal
};

const { ChannelType } = require('discord.js');
const { createProjectModal, createProjectLogModal } = require('../components/modals/projectModal');
const { createSetupProjectsRow } = require('../components/buttons/setupButtons');
const { createEmbed } = require('../utils/embed');
const { safeReply } = require('../utils/discord');
const { findForumChannel, findTextChannel } = require('../utils/resolvers');
const { createProject } = require('../repositories/projectRepository');

function projectTemplate(name, description, stack, status, type) {
    return [
        `## Project: ${name}`,
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

    const thread = await forum.threads.create({
        name,
        message: { content: projectTemplate(name, description, stack, status, type) }
    });

    createProject({
        guildId: interaction.guild.id,
        threadId: thread.id,
        creatorId: interaction.user.id,
        name,
        description,
        stack,
        status,
        createdAt: new Date().toISOString()
    });

    return safeReply(interaction, { content: `Project created: ${thread}`, flags: 64 });
}

async function addProjectLogFromModal(interaction, config) {
    const projectName = interaction.fields.getTextInputValue('project_name_for_log');
    const entry = interaction.fields.getTextInputValue('project_log_entry');

    const forum = findForumChannel(interaction.guild, config.channels.channels.projectsForum);

    if (!forum) {
        return safeReply(interaction, { content: 'Projects forum not found.', flags: 64 });
    }

    let thread = forum.threads.cache.find(t => t.name.toLowerCase() === projectName.toLowerCase());
    if (!thread) {
        const fetched = await forum.threads.fetchActive();
        thread = fetched.threads.find(t => t.name.toLowerCase() === projectName.toLowerCase());
    }

    if (!thread || thread.type !== ChannelType.PublicThread) {
        return safeReply(interaction, { content: `Project "${projectName}" not found.`, flags: 64 });
    }

    const logEntry = `#### ${new Date().toLocaleDateString('de-DE')}\n- ${entry}`;
    await thread.send({ content: logEntry });

    return safeReply(interaction, { content: `Log entry added to project "${projectName}".`, flags: 64 });
}

module.exports = {
    postProjectPanel,
    openProjectCreateModal,
    openProjectLogModal,
    createProjectFromModal,
    addProjectLogFromModal
};

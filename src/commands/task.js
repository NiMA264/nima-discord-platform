const { SlashCommandBuilder } = require('discord.js');
const { safeReply } = require('../utils/discord');
const { requireProjectRole } = require('../permissions/requireProjectRole');
const { ProjectRole } = require('../domain/projectRole');
const { createTask, assignTask, closeTask } = require('../services/taskService');
const { findTaskByUid } = require('../repositories/taskRepository');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('task')
        .setDescription('Task management commands')
        .addSubcommand(sub =>
            sub
                .setName('create')
                .setDescription('Create a task')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
                .addStringOption(opt => opt.setName('title').setDescription('Task title').setRequired(true))
                .addStringOption(opt => opt.setName('description').setDescription('Task description').setRequired(false))
        )
        .addSubcommand(sub =>
            sub
                .setName('assign')
                .setDescription('Assign a task')
                .addStringOption(opt => opt.setName('task_id').setDescription('Task UID').setRequired(true))
                .addUserOption(opt => opt.setName('user').setDescription('Assignee').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('close')
                .setDescription('Close a task')
                .addStringOption(opt => opt.setName('task_id').setDescription('Task UID').setRequired(true))
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: 64 });

        if (sub === 'create') {
            const projectId = interaction.options.getString('project_id', true);
            const title = interaction.options.getString('title', true);
            const description = interaction.options.getString('description') || '';

            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER, ProjectRole.CONTRIBUTOR]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const task = await createTask({ projectId, title, description, actorId: interaction.user.id });
            return safeReply(interaction, { content: `Task created: ${task.task_uid} (${task.title})`, flags: 64 });
        }

        if (sub === 'assign') {
            const taskId = interaction.options.getString('task_id', true);
            const user = interaction.options.getUser('user', true);
            const existing = await findTaskByUid(taskId);
            if (!existing) return safeReply(interaction, { content: 'Task not found.', flags: 64 });

            const permission = await requireProjectRole({
                interaction,
                projectId: existing.project_uid,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const task = await assignTask({ taskId, userId: user.id, actorId: interaction.user.id });
            return safeReply(interaction, { content: `Task assigned: ${task.task_uid} -> <@${user.id}>`, flags: 64 });
        }

        if (sub === 'close') {
            const taskId = interaction.options.getString('task_id', true);
            const existing = await findTaskByUid(taskId);
            if (!existing) return safeReply(interaction, { content: 'Task not found.', flags: 64 });

            const permission = await requireProjectRole({
                interaction,
                projectId: existing.project_uid,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER, ProjectRole.REVIEWER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const task = await closeTask({ taskId, actorId: interaction.user.id });
            return safeReply(interaction, { content: `Task closed: ${task.task_uid}`, flags: 64 });
        }

        return safeReply(interaction, { content: 'Unknown /task subcommand.', flags: 64 });
    }
};

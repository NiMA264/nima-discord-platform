const { SlashCommandBuilder } = require('discord.js');
const { safeReply } = require('../utils/discord');
const { requireProjectRole } = require('../permissions/requireProjectRole');
const { ProjectRole } = require('../domain/projectRole');
const { startSprint, closeSprint } = require('../services/sprintService');
const { findSprintByUid } = require('../repositories/sprintRepository');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sprint')
        .setDescription('Sprint lifecycle commands')
        .addSubcommand(sub =>
            sub
                .setName('start')
                .setDescription('Start sprint for project')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
                .addStringOption(opt => opt.setName('title').setDescription('Sprint title').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('close')
                .setDescription('Close sprint by ID')
                .addStringOption(opt => opt.setName('sprint_id').setDescription('Sprint UID').setRequired(true))
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: 64 });

        if (sub === 'start') {
            const projectId = interaction.options.getString('project_id', true);
            const title = interaction.options.getString('title', true);

            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const sprint = await startSprint({ projectId, title, actorId: interaction.user.id });
            return safeReply(interaction, { content: `Sprint started: ${sprint.sprint_uid} (${sprint.title})`, flags: 64 });
        }

        if (sub === 'close') {
            const sprintId = interaction.options.getString('sprint_id', true);
            const sprint = await findSprintByUid(sprintId);
            if (!sprint) return safeReply(interaction, { content: 'Sprint not found.', flags: 64 });

            const permission = await requireProjectRole({
                interaction,
                projectId: sprint.project_uid,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const closed = await closeSprint({ sprintId, actorId: interaction.user.id });
            return safeReply(interaction, { content: `Sprint closed: ${closed.sprint_uid}`, flags: 64 });
        }

        return safeReply(interaction, { content: 'Unknown /sprint subcommand.', flags: 64 });
    }
};

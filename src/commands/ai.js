const { SlashCommandBuilder } = require('discord.js');
const { safeReply } = require('../utils/discord');
const { requireProjectRole } = require('../permissions/requireProjectRole');
const { ProjectRole } = require('../domain/projectRole');
const { summarizeProject, changelogProject } = require('../services/aiProjectSummaryService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('AI project helpers')
        .addSubcommand(sub =>
            sub
                .setName('summarize')
                .setDescription('Summarize project activity')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('changelog')
                .setDescription('Create changelog from project activity')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
        ),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: 64 });

        if (sub === 'summarize') {
            const projectId = interaction.options.getString('project_id', true);
            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER, ProjectRole.CONTRIBUTOR, ProjectRole.REVIEWER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const summary = await summarizeProject(projectId, { limit: 35, contextLimit: 25 });
            if (!summary) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            const header = summary.usedAi ? '[ai]' : '[deterministic]';
            return safeReply(interaction, { content: `${header}\n\`\`\`txt\n${summary.text}\n\`\`\``, flags: 64 });
        }

        if (sub === 'changelog') {
            const projectId = interaction.options.getString('project_id', true);
            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER, ProjectRole.CONTRIBUTOR, ProjectRole.REVIEWER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const summary = await changelogProject(projectId, { limit: 50, contextLimit: 40 });
            if (!summary) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            const header = summary.usedAi ? '[ai]' : '[deterministic]';
            return safeReply(interaction, { content: `${header}\n\`\`\`txt\n${summary.text}\n\`\`\``, flags: 64 });
        }

        return safeReply(interaction, { content: 'Unknown /ai subcommand.', flags: 64 });
    }
};

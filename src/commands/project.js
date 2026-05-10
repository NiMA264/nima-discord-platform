const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { safeReply } = require('../utils/discord');
const { findForumChannel } = require('../utils/resolvers');
const {
    createProject,
    setDiscordThread,
    addProjectLog,
    archiveProject,
    addProjectMember,
    removeMemberFromProject,
    repairProject
} = require('../services/projectService');
const { findProjectByName } = require('../repositories/projectRepository');
const { getGuildChannelConfig } = require('../services/guildChannelConfigService');
const { requireProjectRole } = require('../permissions/requireProjectRole');
const { ProjectRole, isValidProjectRole } = require('../domain/projectRole');
const { getProjectActivityFeed } = require('../services/projectActivityFeedService');

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('project')
        .setDescription('Project lifecycle commands')
        .addSubcommand(sub =>
            sub
                .setName('create')
                .setDescription('Create a project')
                .addStringOption(opt => opt.setName('name').setDescription('Project name').setRequired(true))
                .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(true))
                .addStringOption(opt => opt.setName('status').setDescription('Status').setRequired(true))
                .addStringOption(opt => opt.setName('type').setDescription('Type').setRequired(true))
                .addStringOption(opt => opt.setName('stack').setDescription('Tech stack').setRequired(false))
        )
        .addSubcommand(sub =>
            sub
                .setName('archive')
                .setDescription('Archive project by ID')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('repair')
                .setDescription('Repair project consistency by ID')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('log')
                .setDescription('Add log entry to a project')
                .addStringOption(opt => opt.setName('project_name').setDescription('Project name').setRequired(true))
                .addStringOption(opt => opt.setName('entry').setDescription('Log entry').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('feed')
                .setDescription('Show project activity feed')
                .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Feed entries').setRequired(false))
        )
        .addSubcommandGroup(group =>
            group
                .setName('member')
                .setDescription('Manage project members')
                .addSubcommand(sub =>
                    sub
                        .setName('add')
                        .setDescription('Add or update member role')
                        .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
                        .addUserOption(opt => opt.setName('user').setDescription('Discord user').setRequired(true))
                        .addStringOption(opt =>
                            opt
                                .setName('role')
                                .setDescription('Project role')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'PROJECT_LEAD', value: 'PROJECT_LEAD' },
                                    { name: 'MAINTAINER', value: 'MAINTAINER' },
                                    { name: 'REVIEWER', value: 'REVIEWER' },
                                    { name: 'CONTRIBUTOR', value: 'CONTRIBUTOR' }
                                )
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('remove')
                        .setDescription('Remove member from project')
                        .addStringOption(opt => opt.setName('project_id').setDescription('Project UID').setRequired(true))
                        .addUserOption(opt => opt.setName('user').setDescription('Discord user').setRequired(true))
                )
        ),
    async execute(interaction, config) {
        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);
        await interaction.deferReply({ flags: 64 });

        if (sub === 'create') {
            const name = interaction.options.getString('name', true);
            const description = interaction.options.getString('description', true);
            const status = interaction.options.getString('status', true);
            const type = interaction.options.getString('type', true);
            const stack = interaction.options.getString('stack') || '';

            const settings = getGuildChannelConfig(interaction.guild.id);
            const forum = findForumChannel(interaction.guild, config.channels.channels.projectsForum, settings.projectForumChannelId);
            if (!forum) return safeReply(interaction, { content: 'Projects forum not found.', flags: 64 });

            const projectRecord = await createProject({
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

            await setDiscordThread(projectRecord.projectUid, thread.id);
            return safeReply(interaction, { content: `Project created: ${thread} (ID: ${projectRecord.projectUid})`, flags: 64 });
        }

        if (sub === 'log') {
            const projectName = interaction.options.getString('project_name', true);
            const entry = interaction.options.getString('entry', true);

            const project = await findProjectByName(interaction.guild.id, projectName);
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

            const settings = getGuildChannelConfig(interaction.guild.id);
            const forum = findForumChannel(interaction.guild, config.channels.channels.projectsForum, settings.projectForumChannelId);
            if (!forum) return safeReply(interaction, { content: 'Projects forum not found.', flags: 64 });

            let thread = forum.threads.cache.find(t => t.id === project.thread_id);
            if (!thread) {
                const fetched = await forum.threads.fetchActive();
                thread = fetched.threads.find(t => t.id === project.thread_id);
            }

            if (!thread || thread.type !== ChannelType.PublicThread) {
                return safeReply(interaction, { content: `Project "${projectName}" thread not found.`, flags: 64 });
            }

            const logEntry = `#### ${new Date().toLocaleDateString('de-DE')}\n- ${entry}`;
            await thread.send({ content: logEntry });
            await addProjectLog({ guildId: interaction.guild.id, projectName, entry, userId: interaction.user.id });
            return safeReply(interaction, { content: `Log entry added to project "${projectName}".`, flags: 64 });
        }

        if (sub === 'archive') {
            const projectId = interaction.options.getString('project_id', true);
            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const archived = await archiveProject(projectId, interaction.user.id);
            if (!archived) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            return safeReply(interaction, { content: `Project archived: ${archived.name} (${projectId})`, flags: 64 });
        }

        if (sub === 'feed') {
            const projectId = interaction.options.getString('project_id', true);
            const limit = interaction.options.getInteger('limit') || 20;
            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER, ProjectRole.CONTRIBUTOR, ProjectRole.REVIEWER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const activity = await getProjectActivityFeed(projectId, { limit });
            if (!activity) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            const lines = activity.feed.slice(0, limit).map((entry, idx) =>
                `${idx + 1}. [${entry.source}] ${entry.type} | ${entry.summary} | ${entry.timestamp}`
            );

            const report = [
                `Activity Feed: ${activity.project.name} (${projectId})`,
                `logs=${activity.counts.logs} tasks=${activity.counts.tasks} sprints=${activity.counts.sprints}`,
                '',
                ...lines
            ].join('\n');

            return safeReply(interaction, { content: `\`\`\`txt\n${report}\n\`\`\``, flags: 64 });
        }

        if (sub === 'repair') {
            const projectId = interaction.options.getString('project_id', true);
            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const repaired = await repairProject({
                guild: interaction.guild,
                projectId,
                actorId: interaction.user.id
            });
            if (!repaired) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            const report = [
                `Repair report for ${repaired.project.name} (${projectId})`,
                `beforeIssues: ${repaired.before.issueCount}`,
                `actions: ${repaired.actions.length}`,
                `afterIssues: ${repaired.after.issueCount}`,
                `issueSummaryBefore: ${JSON.stringify(repaired.before.issueSummary)}`,
                `issueSummaryAfter: ${JSON.stringify(repaired.after.issueSummary)}`
            ].join('\n');

            return safeReply(interaction, { content: `\`\`\`txt\n${report}\n\`\`\``, flags: 64 });
        }

        if (group === 'member' && sub === 'add') {
            const projectId = interaction.options.getString('project_id', true);
            const user = interaction.options.getUser('user', true);
            const role = interaction.options.getString('role', true);

            if (!isValidProjectRole(role)) {
                return safeReply(interaction, { content: 'Invalid project role.', flags: 64 });
            }

            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const project = await addProjectMember(projectId, user.id, role, interaction.user.id);
            if (!project) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            return safeReply(interaction, { content: `Member updated: <@${user.id}> -> ${role} in ${project.name}`, flags: 64 });
        }

        if (group === 'member' && sub === 'remove') {
            const projectId = interaction.options.getString('project_id', true);
            const user = interaction.options.getUser('user', true);

            const permission = await requireProjectRole({
                interaction,
                projectId,
                allowed: [ProjectRole.PROJECT_LEAD, ProjectRole.MAINTAINER]
            });
            if (!permission.ok) return safeReply(interaction, { content: permission.reason, flags: 64 });

            const project = await removeMemberFromProject(projectId, user.id, interaction.user.id);
            if (!project) return safeReply(interaction, { content: 'Project not found.', flags: 64 });

            return safeReply(interaction, { content: `Member removed: <@${user.id}> from ${project.name}`, flags: 64 });
        }

        return safeReply(interaction, { content: 'Unknown /project subcommand.', flags: 64 });
    }
};

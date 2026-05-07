const setupCommand = require('../commands/setup');
const moderationCommand = require('../commands/moderation');
const { hasManageGuildPermission } = require('../utils/permissions');
const { safeInteractionError, safeReply, safeDefer, safeEditReply, safeFinalReply } = require('../utils/discord');
const { findRole } = require('../utils/resolvers');
const { splitDiscordMessage, truncateText } = require('../utils/message');
const { buildServer, buildServerSection, createBuildReportEmbed } = require('../systems/serverBuilder');
const { postWelcomePanel } = require('../systems/welcomeSystem');
const { postRolePanel, applyRoleSelection } = require('../systems/roleSystem');
const { postTicketPanel, createTicketFromModal, requestTicketClose, confirmTicketClose, cancelTicketClose } = require('../systems/ticketSystem');
const { postProjectPanel, openProjectCreateModal, openProjectLogModal, createProjectFromModal, addProjectLogFromModal } = require('../systems/projectSystem');
const { postRules, postServerInfo, postCodingGuidelines, postAiHelpInfo, postProjectGuidelines, postTicketGuidelines, postAnnouncement } = require('../systems/serverControlSystem');
const {
    cleanupDuplicateStructure,
    setAdminSelection,
    getAdminSelection,
    clearAdminSelection,
    executeSelectedCleanup
} = require('../systems/serverRepairSystem');
const { createCleanupSelectMenuRow } = require('../components/selectMenus/cleanupSelectMenu');
const { createServerBuildSelectMenuRow } = require('../components/selectMenus/serverBuildSelectMenu');
const { createCleanupConfirmButtonsRow } = require('../components/buttons/setupButtons');
const { createTicketModal } = require('../components/modals/ticketModal');
const { createAnnouncementModal } = require('../components/modals/announcementModal');

async function safeReplyWithSplit(interaction, content, payload = {}) {
    const chunks = splitDiscordMessage(content, 1900);
    const normalizedChunks = chunks.length ? chunks : [truncateText(content, 1900) || ''];
    const [first, ...rest] = normalizedChunks;

    await safeFinalReply(interaction, {
        ...payload,
        content: first
    });

    for (const chunk of rest) {
        await interaction.followUp({
            content: chunk,
            flags: payload.flags ?? 64
        });
    }
}

function denyIfNoManageGuild(interaction) {
    if (hasManageGuildPermission(interaction.member)) return false;
    safeReply(interaction, { content: 'Nur Admins dürfen diese Aktion ausführen.', flags: 64 });
    return true;
}

async function runSetupAction(interaction, config, value) {
    if (!hasManageGuildPermission(interaction.member)) {
        return safeReply(interaction, { content: 'Nur Admins dürfen Setup-Aktionen ausführen.', flags: 64 });
    }

    if (value === 'build') {
        return safeReply(interaction, {
            content: 'Welche Serverbereiche sollen erstellt/repariert werden?',
            components: [createServerBuildSelectMenuRow()],
            flags: 64
        });
    }

    if (value === 'cleanup_dry_run') {
        await safeDefer(interaction, 64);
        const result = await cleanupDuplicateStructure(interaction.guild, config, { dryRun: true });
        const components = [];

        if (result.options.length) {
            components.push(createCleanupSelectMenuRow(result.options));
        }

        return safeReplyWithSplit(interaction, result.detailedReport, {
            components,
            flags: 64
        });
    }

    if (value === 'cleanup_execute') {
        await safeDefer(interaction, 64);
        const result = await cleanupDuplicateStructure(interaction.guild, config, { dryRun: false });
        if (!result.ok && result.requiresDryRun) {
            return safeEditReply(interaction, { content: 'Cleanup Execute blockiert: Bitte zuerst "Cleanup prüfen" ausführen.', components: [] });
        }

        return safeReply(interaction, {
            content: `Cleanup bereit. Wähle Kandidaten und bestätige danach explizit.`,
            components: result.options.length ? [createCleanupSelectMenuRow(result.options)] : [],
            flags: 64
        });
    }

    if (value === 'rules') {
        await safeDefer(interaction, 64);
        await postRules(interaction.guild, config);
        return safeEditReply(interaction, { content: 'Regeln gepostet.', components: [] });
    }

    if (value === 'welcome') {
        await safeDefer(interaction, 64);
        await postWelcomePanel(interaction.guild, config);
        return safeEditReply(interaction, { content: 'Welcome Panel gesendet.', components: [] });
    }

    if (value === 'roles') {
        await safeDefer(interaction, 64);
        const result = await postRolePanel(interaction.guild, config);
        if (result.errorMessage) {
            return safeEditReply(interaction, { content: `Role Panel fehlgeschlagen: ${result.errorMessage}`, components: [] });
        }

        const createdPart = result.createdRoles?.length ? ` Fehlende Rollen erstellt: ${result.createdRoles.join(', ')}` : '';
        return safeEditReply(interaction, { content: `Role Panel gesendet.${createdPart}`, components: [] });
    }

    if (value === 'tickets') {
        await safeDefer(interaction, 64);
        await postTicketPanel(interaction.guild, config);
        await postTicketGuidelines(interaction.guild, config);
        return safeEditReply(interaction, { content: 'Ticket Panel gesendet.', components: [] });
    }

    if (value === 'projects') {
        await safeDefer(interaction, 64);
        await postProjectPanel(interaction.guild, config);
        await postProjectGuidelines(interaction.guild, config);
        return safeEditReply(interaction, { content: 'Project Panel gesendet.', components: [] });
    }

    if (value === 'server_info') {
        await safeDefer(interaction, 64);
        await postServerInfo(interaction.guild, config);
        return safeEditReply(interaction, { content: 'Server-Info gepostet.', components: [] });
    }

    if (value === 'coding_guidelines') {
        await safeDefer(interaction, 64);
        await postCodingGuidelines(interaction.guild, config);
        return safeEditReply(interaction, { content: 'Coding-Guidelines gepostet.', components: [] });
    }

    if (value === 'ai_help') {
        await safeDefer(interaction, 64);
        await postAiHelpInfo(interaction.guild, config);
        return safeEditReply(interaction, { content: 'AI-Hilfe gepostet.', components: [] });
    }

    if (value === 'announcement') {
        return interaction.showModal(createAnnouncementModal());
    }

    return safeReply(interaction, { content: 'Unbekannte Setup-Aktion.', flags: 64 });
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, config) {
        try {
            if (interaction.isChatInputCommand()) {
                if (interaction.commandName === 'setup') {
                    try {
                        return await setupCommand.execute(interaction, config);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler beim Ausführen von /setup.');
                    }
                }

                if (interaction.commandName === 'moderation') {
                    try {
                        return await moderationCommand.execute(interaction, config);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler beim Ausführen von /moderation.');
                    }
                }
                return;
            }

            if (interaction.isButton()) {
                if (interaction.customId === 'welcome_access_server') {
                    try {
                        const memberRole = findRole(interaction.guild, config.roles.member);
                        if (!memberRole) {
                            return safeReply(interaction, { content: 'Member role not found.', flags: 64 });
                        }

                        if (!interaction.member.roles.cache.has(memberRole.id)) {
                            await interaction.member.roles.add(memberRole);
                        }

                        return safeReply(interaction, { content: 'Access granted. Welcome to NiMa Labs.', flags: 64 });
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler bei der Welcome-Aktion.');
                    }
                }

                if (interaction.customId === 'cleanup_confirm_selected') {
                    if (denyIfNoManageGuild(interaction)) return;
                    await safeDefer(interaction, 64);
                    const selected = getAdminSelection(interaction.guild.id, interaction.user.id);
                    if (!selected) {
                        return safeEditReply(interaction, { content: 'Keine gültige Auswahl vorhanden. Bitte Cleanup prüfen und erneut auswählen.', components: [] });
                    }

                    const execution = await executeSelectedCleanup(interaction.guild, config, selected.selectedValues);
                    clearAdminSelection(interaction.guild.id, interaction.user.id);

                    const deletedLines = [];
                    for (const channel of execution.deleted.channels) {
                        deletedLines.push(`- ${channel.name} (${channel.id})`);
                    }
                    for (const category of execution.deleted.categories) {
                        deletedLines.push(`- ${category.name} (${category.id})`);
                    }

                    const details = deletedLines.length
                        ? `\nGelöscht:\n${deletedLines.join('\n')}`
                        : '\nGelöscht:\n- nichts';

                    return safeReplyWithSplit(interaction, `Cleanup ausgeführt. Gelöscht: ${execution.deleted.channels.length} Channels, ${execution.deleted.categories.length} Kategorien. Übersprungen: ${execution.skipped.length}.${details}`, {
                        flags: 64
                    });
                }

                if (interaction.customId === 'cleanup_cancel_selected') {
                    clearAdminSelection(interaction.guild.id, interaction.user.id);
                    return safeReply(interaction, { content: 'Cleanup-Auswahl verworfen.', flags: 64 });
                }

                if (interaction.customId === 'setup_build_server') return runSetupAction(interaction, config, 'build');
                if (interaction.customId === 'setup_cleanup_dry_run') return runSetupAction(interaction, config, 'cleanup_dry_run');
                if (interaction.customId === 'setup_cleanup_execute') return runSetupAction(interaction, config, 'cleanup_execute');
                if (interaction.customId === 'setup_post_rules') return runSetupAction(interaction, config, 'rules');
                if (interaction.customId === 'setup_post_welcome') return runSetupAction(interaction, config, 'welcome');
                if (interaction.customId === 'setup_post_roles') return runSetupAction(interaction, config, 'roles');
                if (interaction.customId === 'setup_post_tickets') return runSetupAction(interaction, config, 'tickets');
                if (interaction.customId === 'setup_post_projects') return runSetupAction(interaction, config, 'projects');
                if (interaction.customId === 'setup_post_server_info') return runSetupAction(interaction, config, 'server_info');
                if (interaction.customId === 'setup_post_coding_guidelines') return runSetupAction(interaction, config, 'coding_guidelines');
                if (interaction.customId === 'setup_post_ai_help') return runSetupAction(interaction, config, 'ai_help');
                if (interaction.customId === 'server_control_open_announcement_modal') return runSetupAction(interaction, config, 'announcement');

                if (interaction.customId === 'setup_project_create') {
                    if (denyIfNoManageGuild(interaction)) return;
                    return openProjectCreateModal(interaction);
                }

                if (interaction.customId === 'setup_project_log') {
                    if (denyIfNoManageGuild(interaction)) return;
                    return openProjectLogModal(interaction);
                }

                if (interaction.customId === 'ticket_open_modal') return interaction.showModal(createTicketModal());
                if (interaction.customId === 'ticket_close') return requestTicketClose(interaction);
                if (interaction.customId === 'ticket_close_confirm') return confirmTicketClose(interaction, config);
                if (interaction.customId === 'ticket_close_cancel') return cancelTicketClose(interaction);
                return;
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'cleanup_select_channels') {
                    if (denyIfNoManageGuild(interaction)) return;
                    setAdminSelection(interaction.guild.id, interaction.user.id, interaction.values);
                    return safeReply(interaction, {
                        content: `Auswahl gespeichert (${interaction.values.length}). Bitte bestätigen.`,
                        components: [createCleanupConfirmButtonsRow()],
                        flags: 64
                    });
                }

                if (interaction.customId === 'setup_action_menu') {
                    try {
                        return await runSetupAction(interaction, config, interaction.values[0]);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler bei Setup-Auswahl.');
                    }
                }

                if (interaction.customId === 'server_build_select') {
                    try {
                        if (denyIfNoManageGuild(interaction)) return;
                        await safeDefer(interaction, 64);
                        const selected = interaction.values[0];
                        const sectionMap = {
                            build_info: 'info',
                            build_coding: 'coding',
                            build_projects: 'projects',
                            build_support: 'support',
                            build_community: 'community',
                            build_logs: 'logs',
                            build_all: 'all'
                        };

                        const section = sectionMap[selected];
                        if (!section) {
                            return safeReply(interaction, { content: 'Ungültige Build-Auswahl.', flags: 64 });
                        }

                        const report = section === 'all'
                            ? await buildServer(interaction.guild, config)
                            : await buildServerSection(interaction.guild, config, section);

                        const embed = createBuildReportEmbed(report, config, section);
                        return safeEditReply(interaction, { embeds: [embed], components: [] });
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler bei Server-Build Auswahl.');
                    }
                }

                if (interaction.customId === 'role_select') {
                    try {
                        return await applyRoleSelection(interaction);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler beim Rollen-Update.');
                    }
                }

                if (interaction.customId === 'server_control_menu') {
                    try {
                        return await runSetupAction(interaction, config, interaction.values[0]);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler bei Server-Control Auswahl.');
                    }
                }

                return;
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'ticket_create_modal') {
                    try {
                        return await createTicketFromModal(interaction, config);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler beim Ticket-Erstellen.');
                    }
                }

                if (interaction.customId === 'project_create_modal') {
                    try {
                        return await createProjectFromModal(interaction, config);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler beim Projekt-Erstellen.');
                    }
                }

                if (interaction.customId === 'project_log_modal') {
                    try {
                        return await addProjectLogFromModal(interaction, config);
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler beim Projekt-Log.');
                    }
                }

                if (interaction.customId === 'announcement_create_modal') {
                    try {
                        if (denyIfNoManageGuild(interaction)) return;

                        const result = await postAnnouncement(interaction.guild, config, interaction.user, {
                            title: interaction.fields.getTextInputValue('announcement_title'),
                            description: interaction.fields.getTextInputValue('announcement_description'),
                            category: interaction.fields.getTextInputValue('announcement_category'),
                            importance: interaction.fields.getTextInputValue('announcement_importance'),
                            pingRoleName: interaction.fields.getTextInputValue('announcement_ping_role')
                        });

                        if (!result.ok) {
                            return safeReply(interaction, { content: `Ankündigung fehlgeschlagen: ${result.reason}`, flags: 64 });
                        }

                        return safeReply(interaction, { content: `Ankündigung veröffentlicht: ${result.message}`, flags: 64 });
                    } catch (err) {
                        return safeInteractionError(interaction, err, 'Fehler bei der Ankündigung.');
                    }
                }
            }
        } catch (err) {
            return safeInteractionError(interaction, err, 'Unerwarteter Interaktionsfehler.');
        }
    }
};


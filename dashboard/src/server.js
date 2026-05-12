require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { loadDashboardEnv } = require('./config/env');
const { createSessionMiddleware } = require('./lib/session');
const {
    exchangeCodeForToken,
    fetchCurrentUser,
    fetchUserGuilds,
    buildAuthorizeUrl
} = require('./lib/discordOAuthClient');
const { createApiClient } = require('./lib/apiClient');
const {
    listProjectsForGuild,
    getProjectDashboardView,
    getAnalyticsOverviewForGuild,
    listRoleBindingsForGuild,
    updateRoleBinding,
    updateProjectMemberRole,
    isGuildAdmin
} = require('./lib/platformServiceClient');
const { getSupportInviteUrl } = require('../../src/content/supportServerNotice');

const PROJECT_ROLES = ['PROJECT_LEAD', 'MAINTAINER', 'REVIEWER', 'CONTRIBUTOR'];

function renderLayout({ title, body, user }) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #0b1020; color: #e9eefc; }
    header { display:flex; justify-content:space-between; padding:16px 24px; background:#121a33; border-bottom:1px solid #27325c; }
    main { padding: 24px; max-width: 960px; margin: 0 auto; }
    a, a:visited { color: #8ab4ff; }
    .card { background:#121a33; border:1px solid #27325c; border-radius:12px; padding:16px; margin-bottom: 16px; }
    .guild, .item { padding:8px 0; border-bottom:1px solid #27325c; }
    .guild:last-child, .item:last-child { border-bottom:none; }
    .meta { color: #aab6df; font-size: 12px; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .flash-ok { color:#6ee7b7; }
    .flash-error { color:#fca5a5; }
    input, select, button { padding: 6px 8px; margin-right:8px; }
    form { margin-top: 10px; }
  </style>
</head>
<body>
  <header>
    <strong>NiMa Dashboard v1</strong>
    <div>${user ? `Signed in as ${user.username}` : 'Not signed in'}</div>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function requireAuth(req, res, next) {
    if (!req.session?.accessToken) {
        return res.redirect('/login');
    }
    return next();
}

function renderErrorCard(title, message) {
    return `<div class="card"><h2>${title}</h2><p>${message}</p></div>`;
}

function roleOptions(selected) {
    return PROJECT_ROLES.map(role => `<option value="${role}"${selected === role ? ' selected' : ''}>${role}</option>`).join('');
}

function setGuildMembershipCache(req, guilds) {
    req.session.guildMemberships = Object.fromEntries(guilds.map(g => [g.id, g]));
}

function getGuildMembership(req, guildId) {
    return req.session.guildMemberships?.[guildId] || null;
}

function flashFromQuery(query) {
    const type = String(query?.flashType || '');
    const message = String(query?.flash || '');
    if (!message) return '';
    const klass = type === 'ok' ? 'flash-ok' : 'flash-error';
    return `<p class="${klass}">${message}</p>`;
}

function createDashboardServer() {
    const env = loadDashboardEnv(process.env);
    const supportInviteUrl = getSupportInviteUrl(process.env);
    const app = express();
    const apiClient = createApiClient({ baseUrl: `http://127.0.0.1:${env.port}` });

    app.use(createSessionMiddleware(env.sessionSecret));
    app.use(express.urlencoded({ extended: false }));

    app.get('/', (req, res) => {
        if (!req.session?.accessToken) {
            const body = [
                '<div class="card">',
                '<h1>Dashboard Access</h1>',
                '<p>Login with Discord to continue.</p>',
                '<p><strong>Pflicht:</strong> Mitglied im offiziellen NiMa Support-Server.</p>',
                `<p><a href="${supportInviteUrl}" target="_blank" rel="noreferrer">Support-Server beitreten</a></p>`,
                '<p><a href="/login">Login with Discord</a></p>',
                '</div>'
            ].join('');
            return res.send(renderLayout({ title: 'Dashboard Login', body, user: null }));
        }

        return res.redirect('/app');
    });

    app.get('/login', (req, res) => {
        const state = crypto.randomUUID();
        req.session.oauthState = state;

        const authorizeUrl = buildAuthorizeUrl({
            clientId: env.discordClientId,
            redirectUri: env.discordRedirectUri,
            state
        });

        return res.redirect(authorizeUrl);
    });

    app.get('/auth/discord/callback', async (req, res) => {
        const { code, state } = req.query;
        if (!code || !state || state !== req.session.oauthState) {
            return res.status(400).send('Invalid OAuth callback state.');
        }

        const tokenData = await exchangeCodeForToken({
            clientId: env.discordClientId,
            clientSecret: env.discordClientSecret,
            redirectUri: env.discordRedirectUri,
            code: String(code)
        });

        req.session.accessToken = tokenData.access_token;
        req.session.user = await fetchCurrentUser(tokenData.access_token);
        delete req.session.oauthState;

        return res.redirect('/app');
    });

    app.get('/logout', (req, res) => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });

    app.get('/api/guilds', requireAuth, async (req, res) => {
        try {
            const guilds = await fetchUserGuilds(req.session.accessToken);
            setGuildMembershipCache(req, guilds);
            res.json({ guilds });
        } catch (err) {
            res.status(502).json({ error: `Guild fetch failed: ${err.message}` });
        }
    });

    app.get('/api/projects', requireAuth, async (req, res) => {
        try {
            const guildId = String(req.query.guildId || '');
            const workspaceId = String(req.query.workspaceId || '');
            const projects = await listProjectsForGuild(guildId, {
                userId: req.session.user?.id,
                workspaceId
            });
            res.json({ projects });
        } catch (err) {
            res.status(500).json({ error: `Project list failed: ${err.message}` });
        }
    });

    app.get('/api/projects/:projectId', requireAuth, async (req, res) => {
        try {
            const workspaceId = String(req.query.workspaceId || '');
            const detail = await getProjectDashboardView(String(req.params.projectId || ''), {
                userId: req.session.user?.id,
                workspaceId
            });
            if (!detail) return res.status(404).json({ error: 'Project not found' });
            res.json(detail);
        } catch (err) {
            res.status(500).json({ error: `Project detail failed: ${err.message}` });
        }
    });

    app.get('/api/analytics/overview', requireAuth, async (req, res) => {
        try {
            const guildId = String(req.query.guildId || '');
            const workspaceId = String(req.query.workspaceId || '');
            const overview = await getAnalyticsOverviewForGuild(guildId, {
                userId: req.session.user?.id,
                workspaceId
            });
            res.json({ overview });
        } catch (err) {
            res.status(500).json({ error: `Analytics overview failed: ${err.message}` });
        }
    });

    app.get('/api/guilds/:guildId/role-bindings', requireAuth, async (req, res) => {
        try {
            const guildId = String(req.params.guildId || '');
            const roleBindings = listRoleBindingsForGuild(guildId);
            res.json({ roleBindings });
        } catch (err) {
            res.status(500).json({ error: `Role binding list failed: ${err.message}` });
        }
    });

    app.post('/api/guilds/:guildId/role-bindings', requireAuth, express.json(), async (req, res) => {
        try {
            const guildId = String(req.params.guildId || '');
            const actorGuildMembership = getGuildMembership(req, guildId);

            const result = updateRoleBinding({
                actorGuildMembership,
                guildId,
                discordRoleId: String(req.body.discordRoleId || ''),
                projectRole: String(req.body.projectRole || '')
            });

            if (!result.ok) {
                return res.status(result.status).json({ error: result.error });
            }

            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: `Role binding update failed: ${err.message}` });
        }
    });

    app.post('/api/projects/:projectId/members', requireAuth, express.json(), async (req, res) => {
        try {
            const projectId = String(req.params.projectId || '');
            const result = await updateProjectMemberRole({
                actorUserId: req.session.user.id,
                projectId,
                targetUserId: String(req.body.targetUserId || ''),
                targetRole: String(req.body.targetRole || '')
            });

            if (!result.ok) {
                return res.status(result.status).json({ error: result.error });
            }

            return res.json({ ok: true });
        } catch (err) {
            return res.status(500).json({ error: `Project member update failed: ${err.message}` });
        }
    });

    app.get('/app', requireAuth, async (req, res) => {
        try {
            const { guilds } = await apiClient.getGuilds(req.session.accessToken);
            const guildRows = guilds.length
                ? guilds.map(g => `<div class="guild"><strong>${g.name}</strong> <small>(${g.id})</small> <a href="/app/guild/${g.id}/projects">Open</a></div>`).join('')
                : '<div>No guilds available.</div>';

            const body = [
                '<div class="card">',
                '<h1>Server List</h1>',
                '<p>Minimal protected layout for Dashboard v1.</p>',
                guildRows,
                '<p style="margin-top:16px;"><a href="/logout">Logout</a></p>',
                '</div>'
            ].join('');

            return res.send(renderLayout({ title: 'Dashboard', body, user: req.session.user }));
        } catch (err) {
            const body = renderErrorCard('Guild View Error', `Unable to load guilds: ${err.message}`);
            return res.status(500).send(renderLayout({ title: 'Dashboard Error', body, user: req.session.user }));
        }
    });

    app.get('/app/guild/:guildId/projects', requireAuth, async (req, res) => {
        const guildId = String(req.params.guildId || '');
        const workspaceId = String(req.query.workspaceId || '');
        const workspaceQuery = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';

        try {
            const [{ projects }, { roleBindings }, { overview }] = await Promise.all([
                apiClient.getProjects(req.session.accessToken, guildId, workspaceId),
                apiClient.getRoleBindings(req.session.accessToken, guildId),
                apiClient.getAnalyticsOverview(req.session.accessToken, guildId, workspaceId)
            ]);

            const rows = projects.length
                ? projects.map(project => `
                    <div class="item">
                        <strong>${project.name}</strong>
                        <div class="meta">${project.project_uid} | status=${project.status}</div>
                        <a href="/app/projects/${project.project_uid}${workspaceQuery}">Open project</a>
                    </div>`).join('')
                : '<div>No projects found for this guild.</div>';

            const bindingRows = roleBindings.length
                ? roleBindings.map(binding => `<div class="item"><strong>${binding.project_role}</strong> -> ${binding.discord_role_id}</div>`).join('')
                : '<div>No role bindings configured.</div>';

            const flash = flashFromQuery(req.query);
            const isAdmin = isGuildAdmin(getGuildMembership(req, guildId));

            const roleBindingForm = isAdmin
                ? `<form method="post" action="/app/guild/${guildId}/role-bindings">
                    <input type="text" name="discordRoleId" placeholder="Discord Role ID" required />
                    <select name="projectRole">${roleOptions('CONTRIBUTOR')}</select>
                    <button type="submit">Save Binding</button>
                </form>`
                : '<p class="meta">Guild admin permission is required to change role bindings.</p>';

            const body = [
                '<div class="card">',
                `<h1>Projects (${guildId})</h1>`,
                flash,
                '<p><a href="/app">Back to servers</a></p>',
                rows,
                '</div>',
                '<div class="card">',
                '<h2>Analytics Overview</h2>',
                `<div class="item"><strong>activeProjects</strong> ${overview.activeProjects}</div>`,
                `<div class="item"><strong>openTasks</strong> ${overview.openTasks}</div>`,
                `<div class="item"><strong>completedTasks</strong> ${overview.completedTasks}</div>`,
                `<div class="item"><strong>activityVolume</strong> ${overview.activityVolume}</div>`,
                '</div>',
                '<div class="card">',
                '<h2>Guild Role Bindings</h2>',
                bindingRows,
                roleBindingForm,
                '</div>'
            ].join('');

            return res.send(renderLayout({ title: 'Project List', body, user: req.session.user }));
        } catch (err) {
            const body = [
                '<div class="card">',
                '<h1>Projects</h1>',
                '<p><a href="/app">Back to servers</a></p>',
                `<p>Unable to load projects: ${err.message}</p>`,
                '</div>'
            ].join('');

            return res.status(500).send(renderLayout({ title: 'Project List Error', body, user: req.session.user }));
        }
    });

    app.post('/app/guild/:guildId/role-bindings', requireAuth, async (req, res) => {
        const guildId = String(req.params.guildId || '');
        try {
            await apiClient.updateRoleBinding(req.session.accessToken, guildId, {
                discordRoleId: String(req.body.discordRoleId || ''),
                projectRole: String(req.body.projectRole || '')
            });

            return res.redirect(`/app/guild/${guildId}/projects?flashType=ok&flash=Role%20binding%20saved`);
        } catch (err) {
            return res.redirect(`/app/guild/${guildId}/projects?flashType=error&flash=${encodeURIComponent(err.message)}`);
        }
    });

    app.get('/app/projects/:projectId', requireAuth, async (req, res) => {
        const projectId = String(req.params.projectId || '');
        const workspaceId = String(req.query.workspaceId || '');
        const workspaceQuery = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';

        try {
            const detail = await apiClient.getProjectDetail(req.session.accessToken, projectId, workspaceId);
            const project = detail.project;

            const feedRows = detail.feed.length
                ? detail.feed.map(entry => `<div class="item"><strong>${entry.type}</strong><div>${entry.summary}</div><div class="meta">${entry.timestamp}</div></div>`).join('')
                : '<div>No activity yet.</div>';

            const taskRows = detail.tasks.length
                ? detail.tasks.map(task => `<div class="item"><strong>${task.title}</strong><div class="meta">${task.task_uid} | status=${task.status}</div></div>`).join('')
                : '<div>No tasks yet.</div>';

            const sprintRows = detail.sprints.length
                ? detail.sprints.map(sprint => `<div class="item"><strong>${sprint.title}</strong><div class="meta">${sprint.sprint_uid} | status=${sprint.status}</div></div>`).join('')
                : '<div>No sprints yet.</div>';

            const memberRows = detail.members.length
                ? detail.members.map(member => `
                    <div class="item">
                        <strong>${member.user_id}</strong>
                        <div class="meta">role=${member.role}</div>
                        <form method="post" action="/app/projects/${projectId}/members">
                            <input type="hidden" name="targetUserId" value="${member.user_id}" />
                            <select name="targetRole">${roleOptions(member.role)}</select>
                            <button type="submit">Update Role</button>
                        </form>
                    </div>`).join('')
                : '<div>No members yet.</div>';

            const flash = flashFromQuery(req.query);

            const body = [
                '<div class="card">',
                `<h1>${project.name}</h1>`,
                flash,
                `<div class="meta">${project.project_uid} | status=${project.status}</div>`,
                `<p><a href="/app${workspaceQuery}">Back to servers</a></p>`,
                `<p>Counts: logs=${detail.counts.logs}, tasks=${detail.counts.tasks}, sprints=${detail.counts.sprints}</p>`,
                '</div>',
                '<div class="row">',
                `<div class="card"><h2>Task Overview</h2>${taskRows}</div>`,
                `<div class="card"><h2>Sprint Overview</h2>${sprintRows}</div>`,
                '</div>',
                `<div class="card"><h2>Project Members</h2>${memberRows}</div>`,
                `<div class="card"><h2>Activity Feed</h2>${feedRows}</div>`
            ].join('');

            return res.send(renderLayout({ title: 'Project Detail', body, user: req.session.user }));
        } catch (err) {
            const status = err.message.includes('404') ? 404 : 500;
            const body = renderErrorCard('Project Detail Error', `Unable to load project: ${err.message}`);
            return res.status(status).send(renderLayout({ title: 'Project Detail Error', body, user: req.session.user }));
        }
    });

    app.post('/app/projects/:projectId/members', requireAuth, async (req, res) => {
        const projectId = String(req.params.projectId || '');
        try {
            await apiClient.updateProjectMemberRole(req.session.accessToken, projectId, {
                targetUserId: String(req.body.targetUserId || ''),
                targetRole: String(req.body.targetRole || '')
            });

            return res.redirect(`/app/projects/${projectId}?flashType=ok&flash=Member%20role%20updated`);
        } catch (err) {
            return res.redirect(`/app/projects/${projectId}?flashType=error&flash=${encodeURIComponent(err.message)}`);
        }
    });

    return {
        app,
        start() {
            return app.listen(env.port, () => {
                // eslint-disable-next-line no-console
                console.log(`Dashboard listening on http://localhost:${env.port}`);
            });
        }
    };
}

if (require.main === module) {
    const { start } = createDashboardServer();
    start();
}

module.exports = {
    createDashboardServer
};

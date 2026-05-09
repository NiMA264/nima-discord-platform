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
const { listProjectsForGuild, getProjectDashboardView } = require('./lib/platformServiceClient');

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

function createDashboardServer() {
    const env = loadDashboardEnv(process.env);
    const app = express();
    const apiClient = createApiClient({ baseUrl: `http://127.0.0.1:${env.port}` });

    app.use(createSessionMiddleware(env.sessionSecret));

    app.get('/', (req, res) => {
        if (!req.session?.accessToken) {
            const body = '<div class="card"><h1>Dashboard Access</h1><p>Login with Discord to continue.</p><p><a href="/login">Login with Discord</a></p></div>';
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
            res.json({ guilds });
        } catch (err) {
            res.status(502).json({ error: `Guild fetch failed: ${err.message}` });
        }
    });

    app.get('/api/projects', requireAuth, async (req, res) => {
        try {
            const guildId = String(req.query.guildId || '');
            const projects = await listProjectsForGuild(guildId);
            res.json({ projects });
        } catch (err) {
            res.status(500).json({ error: `Project list failed: ${err.message}` });
        }
    });

    app.get('/api/projects/:projectId', requireAuth, async (req, res) => {
        try {
            const detail = await getProjectDashboardView(String(req.params.projectId || ''));
            if (!detail) return res.status(404).json({ error: 'Project not found' });
            res.json(detail);
        } catch (err) {
            res.status(500).json({ error: `Project detail failed: ${err.message}` });
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

        try {
            const { projects } = await apiClient.getProjects(req.session.accessToken, guildId);
            const rows = projects.length
                ? projects.map(project => `
                    <div class="item">
                        <strong>${project.name}</strong>
                        <div class="meta">${project.project_uid} | status=${project.status}</div>
                        <a href="/app/projects/${project.project_uid}">Open project</a>
                    </div>`).join('')
                : '<div>No projects found for this guild.</div>';

            const body = [
                '<div class="card">',
                `<h1>Projects (${guildId})</h1>`,
                '<p><a href="/app">Back to servers</a></p>',
                rows,
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

    app.get('/app/projects/:projectId', requireAuth, async (req, res) => {
        const projectId = String(req.params.projectId || '');

        try {
            const detail = await apiClient.getProjectDetail(req.session.accessToken, projectId);
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

            const body = [
                '<div class="card">',
                `<h1>${project.name}</h1>`,
                `<div class="meta">${project.project_uid} | status=${project.status}</div>`,
                '<p><a href="/app">Back to servers</a></p>',
                `<p>Counts: logs=${detail.counts.logs}, tasks=${detail.counts.tasks}, sprints=${detail.counts.sprints}</p>`,
                '</div>',
                '<div class="row">',
                `<div class="card"><h2>Task Overview</h2>${taskRows}</div>`,
                `<div class="card"><h2>Sprint Overview</h2>${sprintRows}</div>`,
                '</div>',
                `<div class="card"><h2>Activity Feed</h2>${feedRows}</div>`
            ].join('');

            return res.send(renderLayout({ title: 'Project Detail', body, user: req.session.user }));
        } catch (err) {
            const status = err.message.includes('404') ? 404 : 500;
            const body = renderErrorCard('Project Detail Error', `Unable to load project: ${err.message}`);
            return res.status(status).send(renderLayout({ title: 'Project Detail Error', body, user: req.session.user }));
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

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
    .card { background:#121a33; border:1px solid #27325c; border-radius:12px; padding:16px; }
    .guild { padding:8px 0; border-bottom:1px solid #27325c; }
    .guild:last-child { border-bottom:none; }
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
        const guilds = await fetchUserGuilds(req.session.accessToken);
        res.json({ guilds });
    });

    app.get('/app', requireAuth, async (req, res) => {
        const { guilds } = await apiClient.getGuilds(req.session.accessToken);
        const guildRows = guilds.length
            ? guilds.map(g => `<div class="guild"><strong>${g.name}</strong> <small>(${g.id})</small></div>`).join('')
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

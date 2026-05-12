const http = require('http');
const { URL } = require('url');
const { info, warn } = require('../../utils/logger');
const { authenticateApiRequest } = require('./middleware/auth');
const projectsRoute = require('./routes/projects');
const tasksRoute = require('./routes/tasks');
const activityRoute = require('./routes/activity');
const workspacesRoute = require('./routes/workspaces');
const analyticsRoute = require('./routes/analytics');
const activityInsightsRoute = require('./routes/activityInsights');
const workflowSuggestionsRoute = require('./routes/workflowSuggestions');

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw);
}

function resolveHandler(method, pathname) {
    if (pathname === '/v1/workspaces' && method === 'GET') return { handler: workspacesRoute.getWorkspaces, params: {} };
    if (pathname === '/v1/workspaces' && method === 'POST') return { handler: workspacesRoute.postWorkspaces, params: {} };
    if (pathname.startsWith('/v1/workspaces/') && method === 'GET') {
        const id = pathname.split('/')[3] || '';
        return { handler: workspacesRoute.getWorkspaceById, params: { id } };
    }
    if (pathname === '/v1/projects' && method === 'GET') return { handler: projectsRoute.getProjects, params: {} };
    if (pathname === '/v1/projects' && method === 'POST') return { handler: projectsRoute.postProjects, params: {} };
    if (pathname === '/v1/tasks' && method === 'GET') return { handler: tasksRoute.getTasks, params: {} };
    if (pathname === '/v1/tasks' && method === 'POST') return { handler: tasksRoute.postTasks, params: {} };
    if (pathname === '/v1/activity' && method === 'GET') return { handler: activityRoute.getActivity, params: {} };
    if (pathname === '/v1/activity' && method === 'POST') return { handler: activityRoute.postActivity, params: {} };
    if (pathname === '/v1/analytics/overview' && method === 'GET') return { handler: analyticsRoute.getAnalyticsOverview, params: {} };
    if (pathname === '/v1/analytics/activity' && method === 'GET') return { handler: activityInsightsRoute.getActivityInsights, params: {} };
    if (pathname === '/v1/analytics/suggestions' && method === 'GET') return { handler: workflowSuggestionsRoute.getWorkflowSuggestions, params: {} };
    return null;
}

function startPublicApiServer() {
    const enabled = String(process.env.PUBLIC_API_ENABLED || 'true').toLowerCase() !== 'false';
    if (!enabled) return null;

    const port = Number(process.env.PUBLIC_API_PORT || 8790);
    const server = http.createServer(async (req, res) => {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const resolved = resolveHandler(req.method, requestUrl.pathname);
        if (!resolved) {
            sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
            return;
        }

        const auth = authenticateApiRequest(req);
        if (!auth.ok) {
            sendJson(res, auth.statusCode, auth.body);
            return;
        }

        try {
            const body = req.method === 'POST' ? await readJsonBody(req) : {};
            const requestWithParams = {
                ...req,
                params: resolved.params || {},
                query: Object.fromEntries(requestUrl.searchParams.entries())
            };
            const result = await resolved.handler(requestWithParams, body, auth.context);
            sendJson(res, result.statusCode || 200, result.body || { ok: true });
        } catch (err) {
            sendJson(res, 400, {
                ok: false,
                error: { code: 'BAD_REQUEST', message: err.message || 'Invalid request' }
            });
        }
    });

    server.listen(port, () => info('Public API server started', { port }));
    server.on('error', err => warn('Public API server error', { error: err.message }));
    return server;
}

module.exports = {
    startPublicApiServer
};

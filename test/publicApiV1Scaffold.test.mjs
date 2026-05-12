import { describe, it, expect } from 'vitest';
import authModule from '../src/api/v1/middleware/auth.js';
import projectsRoute from '../src/api/v1/routes/projects.js';
import tasksRoute from '../src/api/v1/routes/tasks.js';
import activityRoute from '../src/api/v1/routes/activity.js';
import workspacesRoute from '../src/api/v1/routes/workspaces.js';
import analyticsRoute from '../src/api/v1/routes/analytics.js';

const { authenticateApiRequest } = authModule;

describe('public api v1 scaffold', () => {
    it('auth middleware allows requests when token is not configured', () => {
        const result = authenticateApiRequest({ headers: {} }, {});
        expect(result.ok).toBe(true);
        expect(result.context.authMode).toBe('disabled');
    });

    it('auth middleware rejects invalid bearer token when configured', () => {
        const result = authenticateApiRequest(
            { headers: { authorization: 'Bearer wrong' } },
            { PUBLIC_API_TOKEN: 'secret' }
        );
        expect(result.ok).toBe(false);
        expect(result.statusCode).toBe(401);
    });

    it('projects/tasks/activity handlers expose stable placeholder response shapes', () => {
        const context = { authMode: 'disabled' };
        const responses = [
            projectsRoute.getProjects({}, {}, context),
            projectsRoute.postProjects({}, { name: 'demo' }, context),
            tasksRoute.getTasks({}, {}, context),
            tasksRoute.postTasks({}, { title: 'task' }, context),
            activityRoute.getActivity({}, {}, context),
            activityRoute.postActivity({}, { type: 'push' }, context)
        ];

        for (const response of responses) {
            expect(response).toHaveProperty('statusCode');
            expect(response).toHaveProperty('body.ok', true);
            expect(response.body).toHaveProperty('meta.version', 'v1');
            expect(response.body).toHaveProperty('meta.placeholder', true);
            expect(response.body).toHaveProperty('meta.authMode', 'disabled');
        }
    });

    it('workspaces routes expose list/create/detail response shapes', () => {
        const context = { authMode: 'disabled' };
        const listResponse = workspacesRoute.getWorkspaces({}, {}, context);
        const createResponse = workspacesRoute.postWorkspaces({}, { name: `API WS ${Date.now()}` }, context);
        const detailResponse = workspacesRoute.getWorkspaceById({ params: { id: createResponse.body.data.workspaceId } }, {}, context);

        expect(listResponse.statusCode).toBe(200);
        expect(createResponse.statusCode).toBe(201);
        expect(detailResponse.statusCode).toBe(200);
        expect(createResponse.body).toHaveProperty('meta.resource', 'workspaces');
        expect(detailResponse.body).toHaveProperty('meta.version', 'v1');
    });

    it('analytics overview route exposes stable v1 shape', async () => {
        const previousAdapter = process.env.PROJECT_REPO_ADAPTER;
        try {
            process.env.PROJECT_REPO_ADAPTER = 'sqlite';
            const context = { authMode: 'disabled' };
            const response = await analyticsRoute.getAnalyticsOverview({
                query: {
                    guildId: `guild-${Date.now()}`,
                    workspaceId: ''
                }
            }, {}, context);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('ok', true);
            expect(response.body).toHaveProperty('meta.resource', 'analytics');
            expect(response.body).toHaveProperty('meta.version', 'v1');
            expect(response.body).toHaveProperty('meta.placeholder', false);
            expect(response.body.data).toHaveProperty('activeProjects');
            expect(response.body.data).toHaveProperty('openTasks');
            expect(response.body.data).toHaveProperty('inProgressTasks');
            expect(response.body.data).toHaveProperty('completedTasks');
            expect(response.body.data).toHaveProperty('completionRate');
            expect(response.body.data).toHaveProperty('activityVolume');
        } finally {
            process.env.PROJECT_REPO_ADAPTER = previousAdapter;
        }
    });
});

import { describe, it, expect } from 'vitest';
import authModule from '../src/api/v1/middleware/auth.js';
import projectsRoute from '../src/api/v1/routes/projects.js';
import tasksRoute from '../src/api/v1/routes/tasks.js';
import activityRoute from '../src/api/v1/routes/activity.js';

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
});


import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const { initializeDatabase } = await import('../src/database/database.js');
const { createProject, setDiscordThread } = await import('../src/services/projectService.js');
const { createTask } = await import('../src/services/taskService.js');
const { summarizeProject } = await import('../src/services/aiProjectSummaryService.js');
const { ingestGithubWebhook } = await import('../src/integrations/github/githubWebhookIngest.js');
const { processGithubEventsBatch } = await import('../src/workers/githubEventWorker.js');
const { listProjectLogs } = await import('../src/repositories/projectRepository.js');

function buildPushPayload(projectId) {
    return {
        projectId,
        sender: { login: 'smoke-bot' },
        ref: 'refs/heads/main',
        commits: [{ id: '1' }],
        compare: 'https://github.com/org/repo/compare/1',
        repository: {
            full_name: 'org/repo',
            updated_at: '2026-05-09T10:00:00Z',
            html_url: 'https://github.com/org/repo'
        },
        head_commit: { timestamp: '2026-05-09T10:00:00Z' }
    };
}

describe('phase 2 release smoke flows', () => {
    initializeDatabase();

    it('supports project create -> task create -> ai summarize deterministic flow', async () => {
        const createdAt = new Date().toISOString();

        const project = await createProject({
            guildId: 'smoke-guild',
            creatorId: 'smoke-user',
            name: `Smoke Project ${Date.now()}`,
            description: 'Release smoke flow',
            stack: 'node',
            status: 'active',
            type: 'internal',
            forumChannelId: 'forum-smoke',
            createdAt
        });

        await setDiscordThread(project.projectUid, `thread-${Date.now()}`);

        const task = await createTask({
            projectId: project.projectUid,
            title: 'Ship release smoke',
            description: 'Validate phase 2 release path',
            actorId: 'smoke-user'
        });

        expect(task).toBeTruthy();
        expect(task.project_uid).toBe(project.projectUid);

        const previousApiKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        const summary = await summarizeProject(project.projectUid, { limit: 20, contextLimit: 20 });

        process.env.OPENAI_API_KEY = previousApiKey;

        expect(summary).toBeTruthy();
        expect(summary.usedAi).toBe(false);
        expect(summary.text).toContain('Project Summary:');
        expect(summary.text).toContain(project.projectUid);
    });

    it('ingests and processes github webhook events into project logs', async () => {
        const createdAt = new Date().toISOString();

        const project = await createProject({
            guildId: 'smoke-github-guild',
            creatorId: 'smoke-github-user',
            name: `Smoke GitHub ${Date.now()}`,
            description: 'GitHub ingest smoke',
            stack: 'node',
            status: 'active',
            type: 'internal',
            forumChannelId: 'forum-smoke',
            createdAt
        });

        const payload = buildPushPayload(project.projectUid);

        const result = await ingestGithubWebhook({
            headers: {
                'x-github-event': 'push',
                'x-github-delivery': `delivery-${Date.now()}`
            },
            rawBody: JSON.stringify(payload),
            body: payload
        });

        expect(result.ok).toBe(true);

        let totalProcessed = 0;
        for (let i = 0; i < 10; i += 1) {
            const count = await processGithubEventsBatch(100);
            totalProcessed += count;
            if (count === 0) break;
        }

        expect(totalProcessed).toBeGreaterThan(0);

        const logs = await listProjectLogs(project.projectUid, 100);
        const githubLog = logs.find(entry => entry.event_type === 'github.push');

        expect(githubLog).toBeTruthy();
        expect(githubLog.content?.projectId).toBe(project.projectUid);
        expect(githubLog.content?.raw?.repository?.full_name).toBe('org/repo');
    });
});

import { describe, it, expect } from 'vitest';

process.env.PROJECT_REPO_ADAPTER = 'sqlite';

const workspaceServiceModule = await import('../src/domain/workspace/workspaceService.js');
const domainEventServiceModule = await import('../src/domain/events/domainEventService.js');
const aiWorkflowSuggestionServiceModule = await import('../src/services/aiWorkflowSuggestionService.js');

const workspaceService = workspaceServiceModule.default || workspaceServiceModule;
const domainEventService = domainEventServiceModule.default || domainEventServiceModule;
const aiWorkflowSuggestionService = aiWorkflowSuggestionServiceModule.default || aiWorkflowSuggestionServiceModule;

function daysAgo(days) {
    return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

describe('workflow suggestions workspace scope', () => {
    it('returns heuristic suggestions from workspace-scoped events and analytics signals', async () => {
        const guildId = `suggestions-guild-${Date.now()}`;
        const wsA = workspaceService.createWorkspace({ name: `Suggestions A ${Date.now()}`, ownerUserId: 'a' }).workspaceId;
        const wsB = workspaceService.createWorkspace({ name: `Suggestions B ${Date.now()}`, ownerUserId: 'b' }).workspaceId;

        for (let i = 0; i < 6; i += 1) {
            domainEventService.recordDomainEvent({
                workspaceId: wsB,
                type: 'task.assigned',
                entityType: 'task',
                entityId: `task-b-assigned-${i}-${Date.now()}`,
                metadata: {
                    projectId: 'project-b',
                    assigneeUserId: 'discord-heavy',
                    actorId: 'actor-b'
                }
            });
        }

        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'task.status_changed',
            entityType: 'task',
            entityId: `task-b-stale-${Date.now()}`,
            metadata: {
                projectId: 'project-b',
                previousStatus: 'open',
                nextStatus: 'in_progress',
                actorId: 'actor-b'
            }
        });

        // force old project activity by storing old timestamps in metadata-driven interpretation via additional events
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'project.created',
            entityType: 'project',
            entityId: 'project-old',
            metadata: {
                projectId: 'project-old',
                createdAt: daysAgo(20)
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'task.created',
            entityType: 'task',
            entityId: `task-old-${Date.now()}`,
            metadata: {
                projectId: 'project-old',
                createdAt: daysAgo(20)
            }
        });
        domainEventService.recordDomainEvent({
            workspaceId: wsB,
            type: 'task.status_changed',
            entityType: 'task',
            entityId: `task-old2-${Date.now()}`,
            metadata: {
                projectId: 'project-old',
                previousStatus: 'open',
                nextStatus: 'in_progress',
                actorId: 'actor-old',
                createdAt: daysAgo(20)
            }
        });

        domainEventService.recordDomainEvent({
            workspaceId: wsA,
            type: 'task.assigned',
            entityType: 'task',
            entityId: `task-a-${Date.now()}`,
            metadata: {
                projectId: 'project-a',
                assigneeUserId: 'discord-a',
                actorId: 'actor-a'
            }
        });

        const result = await aiWorkflowSuggestionService.getWorkflowSuggestions({
            guildId,
            workspaceId: wsB,
            userId: 'user-b'
        });

        expect(result.workspaceId).toBe(wsB);
        expect(Array.isArray(result.suggestions)).toBe(true);
        expect(result.suggestions.some(item => item.type === 'overloaded_assignee')).toBe(true);
        expect(result.suggestions.every(item => item.entityId !== 'discord-a')).toBe(true);
    });
});

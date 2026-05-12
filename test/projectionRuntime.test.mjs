import { describe, expect, it } from 'vitest';

const runtimeModule = await import('../src/projections/runtime/runProjection.js');
const replayModule = await import('../src/projections/runtime/replayProjection.js');
const registryModule = await import('../src/projections/registry/projectionRegistry.js');

const { runProjection, sortEventsDeterministically } = runtimeModule.default || runtimeModule;
const { replayProjection } = replayModule.default || replayModule;
const { getProjectionsForEventType } = registryModule.default || registryModule;

describe('lightweight projection runtime', () => {
    it('returns projections for supported github event types', () => {
        const projections = getProjectionsForEventType('github.push');
        expect(projections.length).toBeGreaterThan(0);
    });

    it('replays deterministically to the same read-model state', () => {
        const events = [
            {
                eventUid: 'b',
                type: 'github.issue.opened',
                entityId: 'org/repo-b',
                metadata: { sender: 'bob', action: 'opened', issueNumber: 10, url: 'https://github.com/org/repo-b/issues/10' },
                createdAt: '2026-05-12T10:00:02.000Z'
            },
            {
                eventUid: 'a',
                type: 'github.push',
                entityId: 'org/repo-a',
                metadata: { sender: 'alice', ref: 'refs/heads/main', deliveryId: 'd1', repositoryFullName: 'org/repo-a', url: 'https://github.com/org/repo-a/compare/main' },
                createdAt: '2026-05-12T10:00:01.000Z'
            },
            {
                eventUid: 'c',
                type: 'github.pull_request.opened',
                entityId: 'org/repo-a',
                metadata: { sender: 'alice', action: 'opened', pullRequestNumber: 3, url: 'https://github.com/org/repo-a/pull/3' },
                createdAt: '2026-05-12T10:00:03.000Z'
            }
        ];

        const stateA = runProjection(events).state;
        const stateB = runProjection([...events].reverse()).state;

        expect(stateA).toEqual(stateB);
        expect(stateA.contributionCounts.push).toBe(1);
        expect(stateA.contributionCounts.pullRequestsOpened).toBe(1);
        expect(stateA.contributionCounts.issuesOpened).toBe(1);
        expect(stateA.repositoryEventCounts['org/repo-a']).toBe(2);
        expect(stateA.repositoryEventCounts['org/repo-b']).toBe(1);
    });

    it('collects unknown events without crashing', () => {
        const result = runProjection([
            {
                eventUid: 'x1',
                type: 'github.unknown',
                createdAt: '2026-05-12T10:00:00.000Z',
                metadata: {}
            }
        ]);

        expect(result.state).toEqual({});
        expect(result.unknownEvents).toHaveLength(1);
    });

    it('sorts events deterministically and exposes a pure replay helper', () => {
        const sorted = sortEventsDeterministically([
            { eventUid: 'z', createdAt: '2026-05-12T10:00:02.000Z' },
            { eventUid: 'a', createdAt: '2026-05-12T10:00:02.000Z' },
            { eventUid: 'm', createdAt: '2026-05-12T10:00:01.000Z' }
        ]);

        expect(sorted.map(item => item.eventUid)).toEqual(['m', 'a', 'z']);

        const value = replayProjection([1, 2, 3], (state, event) => state + event, 0);
        expect(value).toBe(6);
    });
});

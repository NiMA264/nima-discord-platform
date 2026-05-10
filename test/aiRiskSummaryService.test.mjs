import { describe, it, expect } from 'vitest';
import riskService from '../src/services/aiRiskSummaryService.js';

const { buildRiskHeuristics, deterministicRecommendation } = riskService;

describe('aiRiskSummaryService', () => {
    it('builds blocked/stale/unassigned risk heuristics', () => {
        const now = new Date('2026-05-10T10:00:00.000Z');
        const heuristics = buildRiskHeuristics({
            project: { project_uid: 'p1', name: 'Project 1' },
            now,
            staleSprints: [{ sprint_uid: 's1', title: 'Sprint 1' }],
            unassignedOpenTasks: [{ task_uid: 't1', title: 'Task 1' }],
            blockedTasks: [{ task_uid: 't2', title: 'Task 2' }],
            inactiveDays: 9
        });

        expect(heuristics.projectId).toBe('p1');
        expect(heuristics.risks.some(r => r.type === 'sprint.stale')).toBe(true);
        expect(heuristics.risks.some(r => r.type === 'task.unassigned_open')).toBe(true);
        expect(heuristics.risks.some(r => r.type === 'task.blocked_heuristic')).toBe(true);
        expect(heuristics.risks.some(r => r.type === 'project.inactive')).toBe(true);
        expect(heuristics.totalScore).toBeGreaterThan(0);
    });

    it('renders deterministic recommendation from normalized risk payload', () => {
        const summary = deterministicRecommendation({
            projectId: 'p2',
            projectName: 'Project 2',
            severity: 'high',
            totalScore: 7,
            risks: [
                { type: 'task.blocked_heuristic', severity: 'high', detail: '2 blocked tasks.' },
                { type: 'sprint.stale', severity: 'medium', detail: '1 stale sprint.' }
            ]
        });

        expect(summary).toContain('Risk Summary: Project 2 (p2)');
        expect(summary).toContain('task.blocked_heuristic');
        expect(summary).toContain('recommended-actions');
    });
});

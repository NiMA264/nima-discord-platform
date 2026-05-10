const { OpenAI } = require('openai');
const metrics = require('../lib/metrics');

function buildRiskHeuristics({ project, now, staleSprints, unassignedOpenTasks, blockedTasks, inactiveDays }) {
    const items = [];

    if (inactiveDays >= 7) {
        items.push({
            type: 'project.inactive',
            severity: inactiveDays >= 14 ? 'high' : 'medium',
            score: inactiveDays >= 14 ? 3 : 2,
            detail: `No meaningful project activity for ${inactiveDays} days.`
        });
    }

    if (staleSprints.length > 0) {
        items.push({
            type: 'sprint.stale',
            severity: staleSprints.length >= 2 ? 'high' : 'medium',
            score: staleSprints.length >= 2 ? 3 : 2,
            detail: `${staleSprints.length} active sprint(s) exceeded stale threshold.`
        });
    }

    if (unassignedOpenTasks.length > 0) {
        items.push({
            type: 'task.unassigned_open',
            severity: unassignedOpenTasks.length >= 3 ? 'high' : 'medium',
            score: unassignedOpenTasks.length >= 3 ? 3 : 2,
            detail: `${unassignedOpenTasks.length} open task(s) are unassigned beyond threshold.`
        });
    }

    if (blockedTasks.length > 0) {
        items.push({
            type: 'task.blocked_heuristic',
            severity: blockedTasks.length >= 2 ? 'high' : 'medium',
            score: blockedTasks.length >= 2 ? 3 : 2,
            detail: `${blockedTasks.length} in-progress task(s) likely blocked by age heuristic.`
        });
    }

    const totalScore = items.reduce((sum, item) => sum + item.score, 0);
    const severity = totalScore >= 6 ? 'high' : totalScore >= 3 ? 'medium' : 'low';

    return {
        projectId: project.project_uid,
        projectName: project.name,
        generatedAt: now.toISOString(),
        severity,
        totalScore,
        risks: items
    };
}

function deterministicRecommendation(heuristics) {
    const riskLines = heuristics.risks.map((risk, idx) => `${idx + 1}. [${risk.severity}] ${risk.type}: ${risk.detail}`);
    const actions = [];

    if (heuristics.risks.some(r => r.type === 'task.blocked_heuristic')) {
        actions.push('- Review blocked in-progress tasks and define unblock owners.');
    }
    if (heuristics.risks.some(r => r.type === 'sprint.stale')) {
        actions.push('- Decide sprint closure or scope correction within current cycle.');
    }
    if (heuristics.risks.some(r => r.type === 'task.unassigned_open')) {
        actions.push('- Assign ownership for stale unassigned tasks.');
    }
    if (heuristics.risks.some(r => r.type === 'project.inactive')) {
        actions.push('- Run a project checkpoint and agree on next milestone.');
    }

    return [
        `Risk Summary: ${heuristics.projectName} (${heuristics.projectId})`,
        `severity=${heuristics.severity} score=${heuristics.totalScore}`,
        'signals:',
        ...(riskLines.length ? riskLines : ['- no risk signals']),
        'recommended-actions:',
        ...(actions.length ? actions : ['- no action required'])
    ].join('\n');
}

async function aiRecommendation(heuristics) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { usedAi: false, summary: deterministicRecommendation(heuristics) };
    }

    const client = new OpenAI({ apiKey });
    const prompt = [
        'You are an engineering delivery risk analyst.',
        'Use only the normalized risk payload and produce concise recommendations.',
        JSON.stringify(heuristics)
    ].join('\n\n');

    try {
        const timer = metrics.startTimer('ai_latency_ms', { operation: 'risk-summary' });
        const response = await client.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            input: prompt
        });
        timer.stop({ status: 'success' });
        metrics.increment('ai_requests_total', 1, { operation: 'risk-summary', status: 'success' });

        const text = String(response.output_text || '').trim();
        if (!text) return { usedAi: false, summary: deterministicRecommendation(heuristics) };
        return { usedAi: true, summary: text };
    } catch (_) {
        metrics.increment('ai_requests_total', 1, { operation: 'risk-summary', status: 'failed' });
        return { usedAi: false, summary: deterministicRecommendation(heuristics) };
    }
}

async function generateRiskSummary(input) {
    const heuristics = buildRiskHeuristics(input);
    const recommendation = await aiRecommendation(heuristics);
    return {
        heuristics,
        ...recommendation
    };
}

module.exports = {
    buildRiskHeuristics,
    deterministicRecommendation,
    generateRiskSummary
};

const { OpenAI } = require('openai');
const { getProjectActivityFeed } = require('./projectActivityFeedService');

function buildNormalizedContext(activity, limit = 25) {
    const entries = activity.feed.slice(0, limit).map(entry => ({
        timestamp: entry.timestamp,
        source: entry.source,
        type: entry.type,
        summary: entry.summary
    }));

    return {
        projectId: activity.project.project_uid,
        projectName: activity.project.name,
        status: activity.project.status,
        counts: activity.counts,
        entries
    };
}

function deterministicSummary(context) {
    const head = context.entries.slice(0, 6).map((entry, idx) =>
        `${idx + 1}. ${entry.type} | ${entry.summary} | ${entry.timestamp}`
    );

    return [
        `Project Summary: ${context.projectName} (${context.projectId})`,
        `status=${context.status}`,
        `activity: logs=${context.counts.logs}, tasks=${context.counts.tasks}, sprints=${context.counts.sprints}`,
        'recent:',
        ...(head.length ? head : ['- no recent activity'])
    ].join('\n');
}

async function aiSummary(context) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { usedAi: false, text: deterministicSummary(context) };
    }

    const client = new OpenAI({ apiKey });
    const prompt = [
        'Summarize this project activity in concise engineering language.',
        'Use only the provided normalized context.',
        JSON.stringify(context)
    ].join('\n\n');

    try {
        const response = await client.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            input: prompt
        });

        const text = String(response.output_text || '').trim();
        if (!text) {
            return { usedAi: false, text: deterministicSummary(context) };
        }

        return { usedAi: true, text };
    } catch (_) {
        return { usedAi: false, text: deterministicSummary(context) };
    }
}

async function summarizeProject(projectId, options = {}) {
    const activity = await getProjectActivityFeed(projectId, { limit: options.limit || 30 });
    if (!activity) return null;

    const context = buildNormalizedContext(activity, options.contextLimit || 25);
    const result = await aiSummary(context);

    return {
        project: activity.project,
        context,
        ...result
    };
}

module.exports = {
    summarizeProject,
    deterministicSummary,
    buildNormalizedContext
};

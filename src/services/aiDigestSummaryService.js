const { generateSummaryWithOpenAI } = require('../adapters/openai/openAiSummaryAdapter');

function buildDigestPrompt({ workspaceId, totalSuggestions, bySeverity = [], byType = [] }) {
    const severityText = bySeverity.map(item => `${item.key}:${item.count}`).join(', ') || 'none';
    const typeText = byType.map(item => `${item.key}:${item.count}`).join(', ') || 'none';
    return [
        'Create one short executive summary sentence for a workflow digest.',
        'Do not invent data. Keep it actionable but non-prescriptive.',
        `workspaceId=${workspaceId}`,
        `totalSuggestions=${totalSuggestions}`,
        `severityBreakdown=${severityText}`,
        `typeBreakdown=${typeText}`
    ].join('\n');
}

async function generateAiDigestSummary(digest, options = {}) {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) return { usedAi: false, text: null };

    const adapter = options.adapter || generateSummaryWithOpenAI;
    const prompt = buildDigestPrompt(digest);
    try {
        const text = await adapter({
            prompt,
            model: options.model
        });
        if (!text) return { usedAi: false, text: null };
        return { usedAi: true, text };
    } catch (_) {
        return { usedAi: false, text: null };
    }
}

module.exports = {
    generateAiDigestSummary,
    buildDigestPrompt
};

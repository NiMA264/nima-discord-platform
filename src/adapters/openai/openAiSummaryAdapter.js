const { OpenAI } = require('openai');

async function generateSummaryWithOpenAI({ prompt, model }) {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) return null;

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
        model: model || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: prompt
    });

    return String(response?.output_text || '').trim() || null;
}

module.exports = {
    generateSummaryWithOpenAI
};

const { truncateText } = require('./message');

const EMBED_DESCRIPTION_LIMIT = 3500;
const EMBED_FIELD_VALUE_LIMIT = 1024;

function embedSafe(text, maxLength = EMBED_FIELD_VALUE_LIMIT) {
    const value = String(text || '').trim();
    if (!value) return 'n/a';
    return truncateText(value, maxLength);
}

function formatFocusLabel(focus) {
    const value = String(focus || 'all').toLowerCase();
    if (value === 'all') return 'All';
    return value.replace(/_/g, ' ');
}

function splitSections(text) {
    const value = String(text || '').trim();
    if (!value) return [];
    const normalized = value.replace(/\r\n/g, '\n');
    const blocks = normalized.split(/\n{2,}/).map(v => v.trim()).filter(Boolean);
    return blocks.slice(0, 3);
}

function normalizeSectionName(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'critical' || v === 'criticals') return 'Critical';
    if (v === 'warnings' || v === 'warning') return 'Warnings';
    if (v === 'security') return 'Security';
    if (v === 'performance') return 'Performance';
    if (v === 'suggestions' || v === 'suggestion') return 'Suggestions';
    if (v === 'next steps' || v === 'next-step' || v === 'next steps:') return 'Next Steps';
    if (v === 'likely cause') return 'Likely Cause';
    if (v === 'fix steps') return 'Fix Steps';
    if (v === 'check next') return 'Check Next';
    if (v === 'missing context') return 'Missing Context';
    if (v === 'quick wins' || v === 'quick win') return 'Quick Wins';
    if (v === 'refactor suggestions' || v === 'refactor suggestion') return 'Refactor Suggestions';
    if (v === 'risk notes' || v === 'risks' || v === 'risk note') return 'Risk Notes';
    if (v === 'example rewrite') return 'Example Rewrite';
    return null;
}

function parseMarkdownSections(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const sections = new Map();
    const order = [
        'Critical',
        'Warnings',
        'Security',
        'Performance',
        'Suggestions',
        'Next Steps',
        'Likely Cause',
        'Fix Steps',
        'Check Next',
        'Missing Context',
        'Quick Wins',
        'Refactor Suggestions',
        'Risk Notes',
        'Example Rewrite'
    ];
    let current = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line === '---') continue;
        const heading = line.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
            current = normalizeSectionName(heading[1]);
            if (current && !sections.has(current)) {
                sections.set(current, []);
            }
            continue;
        }
        if (!current) continue;
        sections.get(current).push(rawLine);
    }

    return order
        .filter(name => sections.has(name))
        .map(name => ({
            name,
            value: embedSafe(sections.get(name).join('\n').trim(), EMBED_FIELD_VALUE_LIMIT),
            inline: false
        }))
        .filter(section => section.value && section.value !== 'n/a');
}

function extractIntroBeforeFirstHeading(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const intro = [];
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (/^#{1,6}\s+/.test(line)) break;
        if (!line || line === '---') continue;
        intro.push(rawLine);
    }
    return intro.join('\n').trim();
}

function formatDevEmbedContent(rawText) {
    const sections = parseMarkdownSections(rawText);
    const blocks = splitSections(rawText);
    const intro = sections.length ? extractIntroBeforeFirstHeading(rawText) : '';
    const description = sections.length
        ? embedSafe(intro || 'Structured analysis generated from the provided error context.', EMBED_DESCRIPTION_LIMIT)
        : embedSafe(blocks[0] || rawText, EMBED_DESCRIPTION_LIMIT);
    const prioritized = sections.length
        ? sections
        : blocks.slice(1, 5).map((block, index) => ({
            name: ['Critical', 'Warnings', 'Security', 'Performance', 'Suggestions', 'Next Steps'][index] || 'Suggestions',
            value: embedSafe(block, EMBED_FIELD_VALUE_LIMIT),
            inline: false
        }));
    const fields = prioritized.slice(0, 4);
    const remaining = prioritized.slice(4);
    if (remaining.length) {
        const notes = remaining
            .map(section => `${section.name}: ${section.value}`)
            .join('\n');
        fields.push({
            name: 'Additional Notes',
            value: embedSafe(notes, EMBED_FIELD_VALUE_LIMIT),
            inline: false
        });
    }

    return {
        description,
        fields
    };
}

function getDevFormattingStats(rawText) {
    const normalized = String(rawText || '').replace(/\r\n/g, '\n');
    const sections = parseMarkdownSections(normalized);
    const blocks = splitSections(normalized);
    const intro = sections.length ? extractIntroBeforeFirstHeading(normalized) : '';
    const descriptionSource = sections.length
        ? (intro || 'Structured analysis generated from the provided error context.')
        : (blocks[0] || normalized);
    let truncated = descriptionSource.trim().length > EMBED_DESCRIPTION_LIMIT;

    if (sections.length) {
        for (const section of sections) {
            if (String(section.value || '').length >= EMBED_FIELD_VALUE_LIMIT && normalized.includes(String(section.value || '').slice(0, 20))) {
                const raw = normalized;
                if (raw.length > section.value.length) {
                    truncated = truncated || section.value.endsWith('...');
                }
            }
        }
    } else {
        const fallbackBlocks = blocks.slice(1, 5);
        truncated = truncated || fallbackBlocks.some(block => String(block || '').trim().length > EMBED_FIELD_VALUE_LIMIT);
    }

    return { truncated };
}

module.exports = {
    EMBED_DESCRIPTION_LIMIT,
    EMBED_FIELD_VALUE_LIMIT,
    embedSafe,
    formatFocusLabel,
    parseMarkdownSections,
    formatDevEmbedContent,
    getDevFormattingStats
};

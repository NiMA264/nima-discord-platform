function summarizeByKey(items, keySelector) {
    const map = new Map();
    for (const item of items) {
        const key = String(keySelector(item) || 'unknown');
        map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, count }));
}

function buildWorkspaceDigest({ workspaceId, suggestions = [] }) {
    const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
    const byType = summarizeByKey(safeSuggestions, item => item.type);
    const bySeverity = summarizeByKey(safeSuggestions, item => item.severity);

    return {
        workspaceId,
        totalSuggestions: safeSuggestions.length,
        byType,
        bySeverity
    };
}

function formatWorkspaceDigestLog(digest) {
    const topTypes = digest.byType
        .slice(0, 5)
        .map(item => `${item.key}=${item.count}`)
        .join(', ');
    const severities = digest.bySeverity
        .map(item => `${item.key}=${item.count}`)
        .join(', ');

    return [
        `workspace=${digest.workspaceId}`,
        `totalSuggestions=${digest.totalSuggestions}`,
        `severities=[${severities || 'none'}]`,
        `types=[${topTypes || 'none'}]`
    ].join(' | ');
}

module.exports = {
    buildWorkspaceDigest,
    formatWorkspaceDigestLog
};

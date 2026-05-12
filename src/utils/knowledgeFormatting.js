function formatKnowledgeId(id) {
    const n = Number.parseInt(String(id || '').trim(), 10);
    if (!Number.isInteger(n) || n <= 0) return 'KNW-??????';
    return `KNW-${String(n).padStart(6, '0')}`;
}

function parseKnowledgeId(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const knw = raw.match(/^KNW-(\d{1,12})$/i);
    if (knw) {
        const n = Number.parseInt(knw[1], 10);
        return Number.isInteger(n) && n > 0 ? n : null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function createKnowledgeExcerpt(text, maxLen = 220) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return 'n/a';
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, Math.max(1, maxLen - 1))}…`;
}

function formatAcceptedMarker(isAccepted) {
    return isAccepted ? '✅ Accepted' : '⬜ Unaccepted';
}

function formatConfidenceLabel(confidence) {
    const c = String(confidence || 'low').toLowerCase();
    if (c === 'high') return '🟢 HIGH';
    if (c === 'medium') return '🟡 MEDIUM';
    return '🔴 LOW';
}

function formatIsoTimestamp(iso) {
    if (!iso) return 'n/a';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return String(iso);
    return `<t:${Math.floor(ts / 1000)}:f>`;
}

function embedSafeText(value, maxLen = 1024) {
    return createKnowledgeExcerpt(value, maxLen);
}

function buildJumpLink(guildId, channelId, messageId) {
    if (!guildId || !channelId || !messageId) return null;
    return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function formatSourceLine(entry, context = {}) {
    const channelName = context.channelNameById?.[entry.channel_id] || entry.channel_id || 'n/a';
    const threadName = entry.thread_id
        ? (context.threadNameById?.[entry.thread_id] || entry.thread_id)
        : 'n/a';
    const jump = buildJumpLink(entry.guild_id || context.guildId, entry.channel_id, entry.source_message_id);
    const idPart = formatKnowledgeId(entry.id);
    const accepted = formatAcceptedMarker(Boolean(entry.is_accepted_solution));
    return `${idPart} | ${accepted} | #${channelName} | thread=${threadName}${jump ? ` | ${jump}` : ''}`;
}

module.exports = {
    formatKnowledgeId,
    parseKnowledgeId,
    createKnowledgeExcerpt,
    formatAcceptedMarker,
    formatConfidenceLabel,
    formatIsoTimestamp,
    embedSafeText,
    buildJumpLink,
    formatSourceLine
};

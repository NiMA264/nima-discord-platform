function stripTreePrefixes(value) {
    return String(value || '')
        .replace(/[╭├└│╰]\s*・?/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripEmoji(value) {
    return String(value || '')
        .replace(/<a?:\w+:\d+>/g, ' ')
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeUmlauts(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ß/g, 'ss')
        .replace(/[ä]/g, 'a')
        .replace(/[ö]/g, 'o')
        .replace(/[ü]/g, 'u');
}

function toSlug(value) {
    return normalizeUmlauts(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[・:;,_./\\|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function normalizeDiscordChannelName(name) {
    const noTree = stripTreePrefixes(name);
    const noEmoji = stripEmoji(noTree);
    return toSlug(noEmoji);
}

function toPlain(name) {
    return normalizeDiscordChannelName(name).replace(/-/g, '');
}

function channelNameMatches(actualName, expectedName) {
    const actualSlug = normalizeDiscordChannelName(actualName);
    const expectedSlug = normalizeDiscordChannelName(expectedName);
    if (!actualSlug || !expectedSlug) return false;
    if (actualSlug === expectedSlug) return true;
    return toPlain(actualName) === toPlain(expectedName);
}

module.exports = {
    normalizeDiscordChannelName,
    channelNameMatches
};

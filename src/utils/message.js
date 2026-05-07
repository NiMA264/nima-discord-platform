function truncateText(text, maxLength) {
    const value = String(text || '').trim();
    if (!value) return '';
    if (!Number.isInteger(maxLength) || maxLength <= 0) return value;
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 3)}...`;
}

function splitDiscordMessage(text, maxLength = 1900) {
    const value = String(text || '').trim();
    if (!value) return [];

    const chunks = [];
    let remaining = value;

    while (remaining.length > maxLength) {
        let splitAt = remaining.lastIndexOf('\n', maxLength);
        if (splitAt < Math.floor(maxLength * 0.5)) {
            splitAt = maxLength;
        }

        chunks.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) {
        chunks.push(remaining);
    }

    return chunks;
}

module.exports = {
    truncateText,
    splitDiscordMessage
};

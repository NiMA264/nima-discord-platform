module.exports = {
    enabled: true,
    model: 'gpt-4.1-mini',
    triggerChannels: ['coding-general'],
    maxContextMessages: 14,
    memoryRetentionDays: 14,
    rateLimitWindowMs: 60000,
    rateLimitPerUser: 8,
    fallbackResponse: [
        'Ich kann gerade keine Live-Antwort vom AI-Service abrufen.',
        'Sende bitte:',
        '1. den relevanten Code (als ```code```),',
        '2. die exakte Fehlermeldung/Stacktrace,',
        '3. was du erwartet hast.',
        'Dann helfe ich dir strukturiert beim Debuggen.'
    ].join('\n')
};

function buildBotHelpGuide() {
    return [
        'NiMa Alpha Quickstart',
        '',
        '1. Erste Schritte',
        '- /setup channels',
        '',
        '2. Projektfluss',
        '- /project create',
        '- /task create',
        '- /sprint start',
        '- /project feed',
        '',
        '3. AI/Activity',
        '- /ai summarize project',
        '- /ai changelog',
        '',
        '4. Recovery',
        '- /project repair'
    ].join('\n');
}

module.exports = {
    buildBotHelpGuide
};

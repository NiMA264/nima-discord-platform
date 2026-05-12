const aiWorkflowSuggestionService = require('../../../services/aiWorkflowSuggestionService');

function getWorkflowSuggestions(req, _body, context) {
    const guildId = String(req.query?.guildId || '');
    const workspaceId = String(req.query?.workspaceId || '');

    return aiWorkflowSuggestionService.getWorkflowSuggestions({
        guildId,
        userId: context.userId || '',
        workspaceId
    }).then(data => ({
        statusCode: 200,
        body: {
            ok: true,
            data,
            meta: {
                resource: 'workflowSuggestions',
                version: 'v1',
                placeholder: false,
                authMode: context.authMode
            }
        }
    }));
}

module.exports = {
    getWorkflowSuggestions
};

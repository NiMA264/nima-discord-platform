const activityInsightsService = require('../../../services/activityInsightsService');

function getActivityInsights(req, _body, context) {
    const guildId = String(req.query?.guildId || '');
    const workspaceId = String(req.query?.workspaceId || '');

    return activityInsightsService.getActivityInsights({
        guildId,
        userId: context.userId || '',
        workspaceId
    }).then(data => ({
        statusCode: 200,
        body: {
            ok: true,
            data,
            meta: {
                resource: 'activityInsights',
                version: 'v1',
                placeholder: false,
                authMode: context.authMode
            }
        }
    }));
}

module.exports = {
    getActivityInsights
};

const analyticsService = require('../../../services/analyticsService');

function getAnalyticsOverview(req, _body, context) {
    const guildId = String(req.query?.guildId || '');
    const workspaceId = String(req.query?.workspaceId || '');

    return analyticsService.getAnalyticsOverview({
        guildId,
        userId: context.userId || '',
        workspaceId
    }).then(data => ({
        statusCode: 200,
        body: {
            ok: true,
            data,
            meta: {
                resource: 'analytics',
                version: 'v1',
                placeholder: false,
                authMode: context.authMode
            }
        }
    }));
}

module.exports = {
    getAnalyticsOverview
};

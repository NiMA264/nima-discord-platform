function getProjects(_req, _body, context) {
    return {
        statusCode: 200,
        body: {
            ok: true,
            data: [],
            meta: {
                resource: 'projects',
                version: 'v1',
                placeholder: true,
                authMode: context.authMode
            }
        }
    };
}

function postProjects(_req, body, context) {
    return {
        statusCode: 202,
        body: {
            ok: true,
            data: {
                accepted: true,
                received: body || {}
            },
            meta: {
                resource: 'projects',
                version: 'v1',
                placeholder: true,
                authMode: context.authMode
            }
        }
    };
}

module.exports = {
    getProjects,
    postProjects
};


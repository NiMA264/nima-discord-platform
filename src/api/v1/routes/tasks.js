function getTasks(_req, _body, context) {
    return {
        statusCode: 200,
        body: {
            ok: true,
            data: [],
            meta: {
                resource: 'tasks',
                version: 'v1',
                placeholder: true,
                authMode: context.authMode
            }
        }
    };
}

function postTasks(_req, body, context) {
    return {
        statusCode: 202,
        body: {
            ok: true,
            data: {
                accepted: true,
                received: body || {}
            },
            meta: {
                resource: 'tasks',
                version: 'v1',
                placeholder: true,
                authMode: context.authMode
            }
        }
    };
}

module.exports = {
    getTasks,
    postTasks
};


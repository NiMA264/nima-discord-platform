function buildSessionOptions({ secret, secure, sameSite }) {
    return {
        name: 'nima_dashboard_session',
        secret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite,
            secure,
            maxAge: 1000 * 60 * 60 * 8
        }
    };
}

function createSessionMiddleware({ secret, secure, sameSite }) {
    const session = require('express-session');
    const options = buildSessionOptions({ secret, secure, sameSite });
    return session({
        ...options
    });
}

module.exports = {
    buildSessionOptions,
    createSessionMiddleware
};

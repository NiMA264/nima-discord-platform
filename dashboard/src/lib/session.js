const session = require('express-session');

function createSessionMiddleware(secret) {
    return session({
        name: 'nima_dashboard_session',
        secret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 1000 * 60 * 60 * 8
        }
    });
}

module.exports = {
    createSessionMiddleware
};

function normalizeError(err) {
    if (!err) {
        return { name: 'Error', message: 'Unknown error' };
    }

    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack
        };
    }

    return {
        name: 'Error',
        message: String(err)
    };
}

module.exports = {
    normalizeError
};

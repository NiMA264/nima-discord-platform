const { normalizeError } = require('./errors');
const { scoped } = require('../utils/logger');

const workerErrorLog = scoped('WORKER_ERROR');

function handleWorkerError(workerName, err, context = {}) {
    const normalized = normalizeError(err);

    workerErrorLog.error('Worker execution failed', {
        worker: workerName,
        errorName: normalized.name,
        errorMessage: normalized.message,
        ...context
    });
}

module.exports = {
    handleWorkerError
};

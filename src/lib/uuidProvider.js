const crypto = require('crypto');

let uuidProvider = () => crypto.randomUUID();

function setUuidProvider(provider) {
    if (typeof provider !== 'function') {
        throw new Error('uuid provider must be a function');
    }
    uuidProvider = provider;
}

function resetUuidProvider() {
    uuidProvider = () => crypto.randomUUID();
}

function newUuid() {
    return String(uuidProvider()).trim();
}

module.exports = {
    setUuidProvider,
    resetUuidProvider,
    newUuid
};

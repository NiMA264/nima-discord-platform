const { info } = require('../utils/logger');

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        info('NiMa Bot ready', { user: client.user.tag, userId: client.user.id });
    }
};

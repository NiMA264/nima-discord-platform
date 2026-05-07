const { sendMemberWelcome } = require('../systems/welcomeSystem');
const { logJoinLeaveEvent } = require('../systems/logSystem');
const { error: logError, formatError } = require('../utils/logger');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, config) {
        try {
            await sendMemberWelcome(member, config);
            await logJoinLeaveEvent(member.guild, config, `joined | member=${member.user.tag}`);
        } catch (err) {
            logError('guildMemberAdd failed', { guildId: member.guild.id, error: formatError(err) });
        }
    }
};

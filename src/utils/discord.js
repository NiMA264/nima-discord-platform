const { ChannelType } = require('discord.js');
const { warn, error: logError, formatError } = require('./logger');
const { splitDiscordMessage, truncateText } = require('./message');

function isGuildTextChannel(channel) {
    return Boolean(channel) && channel.type === ChannelType.GuildText;
}

async function safeReply(interaction, payload) {
    return safeFinalReply(interaction, payload);
}

async function safeDefer(interaction, flags = 64) {
    if (interaction.deferred || interaction.replied) return false;
    await interaction.deferReply({ flags });
    return true;
}

async function safeEditReply(interaction, payload) {
    if (interaction.deferred) {
        return interaction.editReply(payload);
    }

    if (interaction.replied) {
        return interaction.followUp(payload);
    }

    return interaction.reply(payload);
}

async function safeFinalReply(interaction, payload) {
    const normalizedPayload = { ...payload };

    if (typeof normalizedPayload.content === 'string' && normalizedPayload.content.length > 2000) {
        const chunks = splitDiscordMessage(normalizedPayload.content, 1900);
        normalizedPayload.content = truncateText(chunks.shift() || '', 1900);

        await safeEditReply(interaction, normalizedPayload);

        for (const chunk of chunks) {
            await interaction.followUp({
                content: chunk,
                flags: normalizedPayload.flags ?? 64
            });
        }

        return;
    }

    if (interaction.deferred) {
        return interaction.editReply(normalizedPayload);
    }

    if (interaction.replied) {
        return interaction.followUp(normalizedPayload);
    }

    return interaction.reply(normalizedPayload);
}

async function safeInteractionError(interaction, err, message = 'Ein Fehler ist aufgetreten.') {
    logError('Interaction error', {
        customId: interaction.customId,
        commandName: interaction.commandName,
        guildId: interaction.guildId,
        userId: interaction.user?.id,
        error: formatError(err)
    });

    if (err && Number(err.code) === 10062) {
        warn('Interaction expired before error reply', {
            customId: interaction.customId,
            commandName: interaction.commandName,
            guildId: interaction.guildId,
            userId: interaction.user?.id
        });
        return;
    }

    try {
        if (interaction.deferred) {
            await interaction.editReply({ content: message, components: [], embeds: [] });
            return;
        }

        await safeFinalReply(interaction, { content: message, flags: 64 });
    } catch (replyErr) {
        warn('Failed to send interaction error reply', { error: formatError(replyErr) });
    }
}

module.exports = {
    isGuildTextChannel,
    safeReply,
    safeDefer,
    safeEditReply,
    safeFinalReply,
    safeInteractionError
};

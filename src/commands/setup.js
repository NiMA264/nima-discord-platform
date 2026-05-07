const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embed');
const { createSetupButtonsRow, createSetupButtonsRow2, createSetupButtonsRow3, createSetupButtonsRow4 } = require('../components/buttons/setupButtons');
const { createSetupMenuRow } = require('../components/selectMenus/setupMenu');

module.exports = {
    data: new SlashCommandBuilder().setName('setup').setDescription('Open NiMa Labs setup panel'),
    async execute(interaction) {
        const embed = createEmbed('NiMa Labs Admin Setup', 'Verwalte den Server über Buttons, Select Menus und Modals.');

        await interaction.reply({
            embeds: [embed],
            components: [createSetupButtonsRow(), createSetupButtonsRow2(), createSetupButtonsRow3(), createSetupButtonsRow4(), createSetupMenuRow()],
            flags: 64
        });
    }
};

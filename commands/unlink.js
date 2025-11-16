import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { unlinkAccount, getUser } from '../utils/userData.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink a gaming account from your Discord profile')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Gaming platform to unlink')
        .setRequired(true)
        .addChoices(
          { name: 'Steam', value: 'steam' },
          { name: 'PlayStation Network', value: 'psn' },
          { name: 'Xbox Live', value: 'xbox' }
        )),

  async execute(interaction) {
    const platform = interaction.options.getString('platform');
    const userId = interaction.user.id;

    const userData = getUser(userId);

    if (!userData || !userData[platform]) {
      return await interaction.reply({
        content: `❌ You don't have a ${platform.toUpperCase()} account linked.`,
        ephemeral: true
      });
    }

    unlinkAccount(userId, platform);

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🔗 Account Unlinked')
      .setDescription(`Your **${platform.toUpperCase()}** account has been unlinked.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../utils/userData.js';
import { getSteamStats } from '../platformStats/steamStats.js';
import { getPSNStats } from '../platformStats/psnStats.js';
import { getXboxStats } from '../platformStats/xboxStats.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View gaming statistics')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to view stats for (defaults to you)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to view stats for')
        .setRequired(false)
        .addChoices(
          { name: 'Steam', value: 'steam' },
          { name: 'PlayStation Network', value: 'psn' },
          { name: 'Xbox Live', value: 'xbox' },
          { name: 'All Platforms', value: 'all' }
        )),
  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const platform = interaction.options.getString('platform') || 'all';
    const userData = getUser(targetUser.id);

    if (!userData || (!userData.steam && !userData.psn && !userData.xbox)) {
      return await interaction.editReply({
        content: `❌ ${targetUser.username} has no linked gaming accounts. Use /link to link accounts.`
      });
    }

    const embed = new EmbedBuilder().setTimestamp();

    if ((platform === 'all' || platform === 'steam') && userData.steam) {
      const steamStats = await getSteamStats(userData.steam);
      if (steamStats.color) embed.setColor(steamStats.color);
      if (steamStats.author) embed.setAuthor(steamStats.author);
      if (steamStats.thumbnail) embed.setThumbnail(steamStats.thumbnail);
      embed.addFields(steamStats.fields);
    } else {
      embed.setColor(0x5865f2);
      embed.setAuthor({
        name: `${targetUser.username}'s Gaming Stats`,
        iconURL: targetUser.displayAvatarURL()
      });
    }

    if ((platform === 'all' || platform === 'psn') && userData.psn) {
      const psnStats = await getPSNStats(userData.psn);
      if (psnStats.color) embed.setColor(psnStats.color);
      if (psnStats.author) embed.setAuthor(psnStats.author);
      if (psnStats.thumbnail) embed.setThumbnail(psnStats.thumbnail);
      embed.addFields(psnStats.fields);
    }

    if ((platform === 'all' || platform === 'xbox') && userData.xbox) {
      const xboxFields = await getXboxStats(userData.xbox);
      embed.addFields(xboxFields);
    }

    if (!embed.data.fields || embed.data.fields.length === 0) {
      return await interaction.editReply({
        content: '❌ No stats available for the selected platform(s).'
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

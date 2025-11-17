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

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: `${targetUser.username}'s Gaming Stats`,
        iconURL: targetUser.displayAvatarURL()
      })
      .setTimestamp();

    let hasAnyStats = false;
    let errorMessages = [];

    // Fetch Steam stats
    if ((platform === 'all' || platform === 'steam') && userData.steam) {
      try {
        const steamStats = await getSteamStats(userData.steam);
        if (steamStats.fields && steamStats.fields.length > 0) {
          if (steamStats.color) embed.setColor(steamStats.color);
          if (steamStats.author) embed.setAuthor(steamStats.author);
          if (steamStats.thumbnail) embed.setThumbnail(steamStats.thumbnail);
          embed.addFields(steamStats.fields);
          hasAnyStats = true;
        }
      } catch (error) {
        console.error('Error fetching Steam stats:', error);
        errorMessages.push('⚠️ Could not fetch Steam data');
      }
    }

    // Fetch PSN stats
    if ((platform === 'all' || platform === 'psn') && userData.psn) {
      try {
        const psnStats = await getPSNStats(userData.psn);
        if (psnStats.fields && psnStats.fields.length > 0) {
          // Only override color/author if Steam didn't set them
          if (psnStats.color && !hasAnyStats) embed.setColor(psnStats.color);
          if (psnStats.author && !hasAnyStats) embed.setAuthor(psnStats.author);
          if (psnStats.thumbnail && !hasAnyStats) embed.setThumbnail(psnStats.thumbnail);
          embed.addFields(psnStats.fields);
          hasAnyStats = true;
        }
      } catch (error) {
        console.error('Error fetching PSN stats:', error);
        errorMessages.push('⚠️ Could not fetch PSN data');
      }
    }

    // Fetch Xbox stats
    if ((platform === 'all' || platform === 'xbox') && userData.xbox) {
      try {
        const xboxFields = await getXboxStats(userData.xbox);
        if (xboxFields && xboxFields.length > 0) {
          embed.addFields(xboxFields);
          hasAnyStats = true;
        }
      } catch (error) {
        console.error('Error fetching Xbox stats:', error);
        errorMessages.push('⚠️ Could not fetch Xbox data');
      }
    }

    // If no stats were fetched at all
    if (!hasAnyStats) {
      return await interaction.editReply({
        content: `❌ No stats available for the selected platform(s).\n${errorMessages.join('\n')}`
      });
    }

    // Add error messages as a field if some platforms failed
    if (errorMessages.length > 0) {
      embed.addFields({
        name: '⚠️ Errors',
        value: errorMessages.join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

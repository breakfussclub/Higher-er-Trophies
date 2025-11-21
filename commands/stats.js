import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
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

    // Fetch linked accounts from database
    const result = await query(
      'SELECT platform, account_id, extra_data FROM linked_accounts WHERE discord_id = $1',
      [targetUser.id]
    );

    const userData = {};
    result.rows.forEach(row => {
      if (row.platform === 'steam') userData.steam = row.account_id;
      if (row.platform === 'psn') userData.psn = row.account_id;
      if (row.platform === 'xbox') userData.xbox = row.account_id;
    });

    if (!userData.steam && !userData.psn && !userData.xbox) {
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
          if (steamStats.footer) embed.setFooter(steamStats.footer);
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
          if (psnStats.footer && !hasAnyStats) embed.setFooter(psnStats.footer);
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
        const xboxStats = await getXboxStats(userData.xbox);
        if (xboxStats.fields && xboxStats.fields.length > 0) {
          // Apply Xbox embed styling if it's the only platform or first platform
          if (xboxStats.color && !hasAnyStats) embed.setColor(xboxStats.color);
          if (xboxStats.author && !hasAnyStats) embed.setAuthor(xboxStats.author);
          if (xboxStats.thumbnail && !hasAnyStats) embed.setThumbnail(xboxStats.thumbnail);
          if (xboxStats.footer && !hasAnyStats) embed.setFooter(xboxStats.footer);
          embed.addFields(xboxStats.fields);
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

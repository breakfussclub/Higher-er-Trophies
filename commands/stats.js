import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
import { getSteamStats } from '../platformStats/steamStats.js';
import { getPSNStats } from '../platformStats/psnStats.js';
import { getXboxStats } from '../platformStats/xboxStats.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View gaming statistics')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Platform to view stats for')
        .setRequired(true)
        .addChoices(
          { name: 'Steam', value: 'steam' },
          { name: 'PlayStation Network', value: 'psn' },
          { name: 'Xbox Live', value: 'xbox' }
        ))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to view stats for (defaults to you)')
        .setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const platform = interaction.options.getString('platform');

    // Fetch linked accounts from database
    const result = await query(
      'SELECT platform, account_id, extra_data FROM linked_accounts WHERE discord_id = $1',
      [targetUser.id]
    );

    const userData = {};
    result.rows.forEach(row => {
      if (row.platform === 'steam') userData.steam = row;
      if (row.platform === 'psn') userData.psn = row;
      if (row.platform === 'xbox') userData.xbox = row;
    });

    if (!userData[platform]) {
      return await interaction.editReply({
        content: `❌ ${targetUser.username} has not linked a **${platform.toUpperCase()}** account.`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: `${targetUser.username}'s Gaming Stats`,
        iconURL: targetUser.displayAvatarURL()
      })
      .setTimestamp();

    let allFields = [];
    let errorMessages = [];

    // Fetch Steam stats
    if (platform === 'steam') {
      try {
        // Use SteamID64 from extra_data if available, otherwise fallback to account_id (username)
        const steamId = userData.steam.extra_data?.steamId64 || userData.steam.account_id;
        const steamStats = await getSteamStats(steamId);
        if (steamStats.fields && steamStats.fields.length > 0) {
          if (steamStats.color) embed.setColor(steamStats.color);
          if (steamStats.author) embed.setAuthor(steamStats.author);
          if (steamStats.thumbnail) embed.setThumbnail(steamStats.thumbnail);
          if (steamStats.footer) embed.setFooter(steamStats.footer);
          allFields.push(...steamStats.fields);
        }
      } catch (error) {
        console.error('Error fetching Steam stats:', error);
        errorMessages.push('⚠️ Could not fetch Steam data');
      }
    }

    // Fetch PSN stats
    if (platform === 'psn') {
      try {
        const psnStats = await getPSNStats(userData.psn.account_id);
        if (psnStats.fields && psnStats.fields.length > 0) {
          if (psnStats.color) embed.setColor(psnStats.color);
          if (psnStats.author) embed.setAuthor(psnStats.author);
          if (psnStats.thumbnail) embed.setThumbnail(psnStats.thumbnail);
          if (psnStats.footer) embed.setFooter(psnStats.footer);
          allFields.push(...psnStats.fields);
        }
      } catch (error) {
        console.error('Error fetching PSN stats:', error);
        errorMessages.push('⚠️ Could not fetch PSN data');
      }
    }

    // Fetch Xbox stats
    if (platform === 'xbox') {
      try {
        const xboxStats = await getXboxStats(userData.xbox.account_id);
        if (xboxStats.fields && xboxStats.fields.length > 0) {
          if (xboxStats.color) embed.setColor(xboxStats.color);
          if (xboxStats.author) embed.setAuthor(xboxStats.author);
          if (xboxStats.thumbnail) embed.setThumbnail(xboxStats.thumbnail);
          if (xboxStats.footer) embed.setFooter(xboxStats.footer);
          allFields.push(...xboxStats.fields);
        }
      } catch (error) {
        console.error('Error fetching Xbox stats:', error);
        errorMessages.push('⚠️ Could not fetch Xbox data');
      }
    }

    // If no stats were fetched at all
    if (allFields.length === 0 && errorMessages.length === 0) {
      return await interaction.editReply({
        content: `❌ No stats available for the selected platform(s).`
      });
    }

    // Add error messages as a field if some platforms failed
    if (errorMessages.length > 0) {
      allFields.push({
        name: '⚠️ Errors',
        value: errorMessages.join('\n'),
        inline: false
      });
    }

    // Check field limit (Discord max is 25)
    if (allFields.length > 25) {
      const excess = allFields.length - 25;
      // Keep the first 24 fields and add a "truncated" notice
      const keptFields = allFields.slice(0, 24);

      keptFields.push({
        name: '⚠️ Truncated',
        value: `...and ${excess + 1} more fields hidden due to Discord limits.`,
        inline: false
      });

      allFields = keptFields;
    }

    try {
      embed.addFields(allFields);
    } catch (error) {
      console.error('[Stats] Error adding fields to embed:', error);
      console.error('[Stats] Invalid Fields:', JSON.stringify(allFields, null, 2));
      // Fallback: Add a simple error field
      embed.addFields({ name: '⚠️ Error', value: 'Failed to generate stats display.', inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

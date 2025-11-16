import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../utils/userData.js';
import { getSteamProfile, getSteamGames } from '../utils/steamAPI.js';
import { getPSNProfile, getPSNTrophySummary } from '../utils/psnAPI.js';
import { getXboxProfile } from '../utils/xboxAPI.js';

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
        content: `❌ ${targetUser.username} has no linked gaming accounts. Use \`/link\` to link accounts.`
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ 
        name: `${targetUser.username}'s Gaming Stats`,
        iconURL: targetUser.displayAvatarURL()
      })
      .setTimestamp();

    try {
      // Steam Stats
      if ((platform === 'all' || platform === 'steam') && userData.steam) {
        try {
          const steamProfile = await getSteamProfile(userData.steam);
          const steamGames = await getSteamGames(userData.steam);

          const totalPlaytime = steamGames.games?.reduce((sum, game) => 
            sum + (game.playtime_forever || 0), 0) || 0;
          const hours = Math.floor(totalPlaytime / 60);

          embed.addFields({
            name: '🎮 Steam',
            value: [
              `**Profile:** [${steamProfile.personaname}](${steamProfile.profileurl})`,
              `**Games Owned:** ${steamGames.game_count || 0}`,
              `**Total Playtime:** ${hours.toLocaleString()} hours`,
              `**Status:** ${getOnlineStatus(steamProfile.personastate)}`
            ].join('\n'),
            inline: false
          });
        } catch (error) {
          embed.addFields({
            name: '🎮 Steam',
            value: '⚠️ Could not fetch Steam data',
            inline: false
          });
        }
      }

      // PSN Stats
      if ((platform === 'all' || platform === 'psn') && userData.psn) {
        try {
          const psnProfile = await getPSNProfile(userData.psn);
          const trophies = await getPSNTrophySummary(psnProfile.accountId);

          embed.addFields({
            name: '🎮 PlayStation Network',
            value: [
              `**Online ID:** ${userData.psn}`,
              `**Level:** ${trophies.trophyLevel || 'N/A'}`,
              `**Trophies:** 🥇${trophies.earnedTrophies?.gold || 0} 🥈${trophies.earnedTrophies?.silver || 0} 🥉${trophies.earnedTrophies?.bronze || 0}`,
              `**Total Trophies:** ${trophies.earnedTrophies?.total || 0}`
            ].join('\n'),
            inline: false
          });
        } catch (error) {
          embed.addFields({
            name: '🎮 PlayStation Network',
            value: '⚠️ Could not fetch PSN data (profile may be private)',
            inline: false
          });
        }
      }

      // Xbox Stats
      if ((platform === 'all' || platform === 'xbox') && userData.xbox) {
        try {
          const xboxProfile = await getXboxProfile(userData.xbox);
          const settings = xboxProfile.profileUsers?.[0]?.settings || [];

          const gamertag = settings.find(s => s.id === 'Gamertag')?.value || userData.xbox;
          const gamerscore = settings.find(s => s.id === 'Gamerscore')?.value || 'N/A';

          embed.addFields({
            name: '🎮 Xbox Live',
            value: [
              `**Gamertag:** ${gamertag}`,
              `**Gamerscore:** ${gamerscore}`,
              `**Account Tier:** ${settings.find(s => s.id === 'AccountTier')?.value || 'N/A'}`
            ].join('\n'),
            inline: false
          });
        } catch (error) {
          embed.addFields({
            name: '🎮 Xbox Live',
            value: '⚠️ Could not fetch Xbox data',
            inline: false
          });
        }
      }

      if (embed.data.fields?.length === 0) {
        return await interaction.editReply({
          content: '❌ No stats available for the selected platform(s).'
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching stats:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching stats. Please try again later.'
      });
    }
  }
};

function getOnlineStatus(state) {
  const statuses = {
    0: 'Offline',
    1: 'Online',
    2: 'Busy',
    3: 'Away',
    4: 'Snooze',
    5: 'Looking to Trade',
    6: 'Looking to Play'
  };
  return statuses[state] || 'Unknown';
}

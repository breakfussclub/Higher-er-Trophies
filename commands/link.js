import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
import { resolveVanityUrl, getSteamProfile, getSteamLevel } from '../services/steamService.js';
import { getPSNAccountId, getPSNProfile } from '../services/psnService.js';
import { searchGamertag, getXboxProfile } from '../services/xboxService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your gaming accounts to your Discord profile')
    .addStringOption(option =>
      option.setName('platform')
        .setDescription('Gaming platform')
        .setRequired(true)
        .addChoices(
          { name: 'Steam', value: 'steam' },
          { name: 'PlayStation Network', value: 'psn' },
          { name: 'Xbox Live', value: 'xbox' }
        ))
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your username/ID on the platform')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const platform = interaction.options.getString('platform');
    const username = interaction.options.getString('username');
    const userId = interaction.user.id;

    try {
      let accountId = username;
      let displayName = username;
      let extraData = {};

      // ===== STEAM =====
      if (platform === 'steam') {
        try {
          let steamId = username;
          // Try to resolve if it looks like a vanity URL or just a name
          if (!/^\d{17}$/.test(username)) {
             try {
               steamId = await resolveVanityUrl(username);
             } catch (e) {
               // If resolution fails, we'll try using it as is, but it likely won't work if it's not an ID
             }
          }

          const profile = await getSteamProfile(steamId);
          accountId = username; // Keep input as accountId or use steamId? Usually steamId64 is better for uniqueness.
          // Let's use the resolved steamId as the unique identifier if possible, but the DB schema uses account_id.
          // Existing code used username as accountId. Let's stick to that to avoid breaking existing links, 
          // but storing steamId64 in extraData is crucial.
          
          displayName = profile.personaname;
          extraData.steamId64 = profile.steamid;
          extraData.avatarUrl = profile.avatarfull;

          // Fetch Level
          const levelData = await getSteamLevel(profile.steamid);
          extraData.steamLevel = levelData?.player_level || 0;

        } catch (error) {
            console.error('Steam Link Error:', error);
            return await interaction.editReply({
              content: '❌ Could not find Steam account. Please provide a valid SteamID64 or Custom URL.',
              ephemeral: true
            });
        }
      }

      // ===== PSN =====
      if (platform === 'psn') {
        try {
          // getPSNProfile handles "me", numeric IDs, and Online IDs
          const profile = await getPSNProfile(username);
          
          accountId = profile.onlineId;
          displayName = profile.onlineId;
          
          extraData.accountId = profile.accountId;
          extraData.trophyLevel = profile.trophyLevel;
          extraData.earnedTrophies = profile.earnedTrophies;
          extraData.avatarUrl = profile.avatarUrl;

        } catch (error) {
          let errorMsg = `❌ Could not link PSN account.\n\n**Error:** ${error.message}\n`;
          return await interaction.editReply({ content: errorMsg, ephemeral: true });
        }
      }

      // ===== XBOX =====
      if (platform === 'xbox') {
        try {
          // Use getXboxProfile to get full stats including Gamerscore
          const profile = await getXboxProfile(username);
          
          displayName = profile.gamertag;
          extraData.xuid = profile.xuid;
          extraData.gamerscore = profile.gamerscore;
          extraData.accountTier = profile.accountTier;
          extraData.profilePicture = profile.profilePicture;

        } catch (error) {
          return await interaction.editReply({
            content: `❌ Could not find Xbox gamertag "${username}". Please check the spelling.`,
            ephemeral: true
          });
        }
      }

      // Save to Database
      // 1. Ensure user exists
      await query(
        `INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT (discord_id) DO NOTHING`,
        [userId]
      );

      // 2. Link account
      await query(
        `INSERT INTO linked_accounts (discord_id, platform, account_id, username, extra_data)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (discord_id, platform) DO UPDATE 
         SET account_id = EXCLUDED.account_id, 
             username = EXCLUDED.username,
             extra_data = EXCLUDED.extra_data,
             created_at = CURRENT_TIMESTAMP`,
        [userId, platform, accountId, displayName, JSON.stringify(extraData)]
      );

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Account Linked Successfully')
        .setDescription(`Your **${platform.toUpperCase()}** account has been linked!`)
        .addFields(
          { name: 'Platform', value: platform.toUpperCase(), inline: true },
          { name: 'Username', value: displayName, inline: true }
        )
        .setFooter({ text: 'Stats have been fetched and you are now on the leaderboard!' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error linking account:', error);
      await interaction.editReply({
        content: `❌ Failed to link account: ${error.message}`,
        ephemeral: true
      });
    }
  }
};

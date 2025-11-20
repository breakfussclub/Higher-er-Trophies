import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
import { resolveVanityUrl, getSteamProfile } from '../services/steamService.js';
import { getPSNAccountId, getPSNProfile } from '../services/psnService.js';
import { searchGamertag } from '../services/xboxService.js';

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
          const profile = await getSteamProfile(username);
          accountId = username;
          displayName = profile.personaname;
          extraData.steamId64 = profile.steamid;
        } catch {
          try {
            accountId = await resolveVanityUrl(username);
            const profile = await getSteamProfile(accountId);
            displayName = profile.personaname;
            extraData.steamId64 = profile.steamid;
          } catch {
            return await interaction.editReply({
              content: '❌ Could not find Steam account. Please provide either your SteamID64 or custom URL name.',
              ephemeral: true
            });
          }
        }
      }

      // ===== PSN =====
      if (platform === 'psn') {
        try {
          const profile = await getPSNProfile(username);
          accountId = profile.onlineId;
          displayName = profile.onlineId;
          extraData.accountId = profile.accountId;
        } catch (error) {
          let errorMsg = `❌ Could not link PSN account.\n\n**Error:** ${error.message}\n`;
          return await interaction.editReply({ content: errorMsg, ephemeral: true });
        }
      }

      // ===== XBOX =====
      if (platform === 'xbox') {
        try {
          const searchResult = await searchGamertag(username);
          displayName = searchResult.gamertag || username;
          extraData.xuid = searchResult.xuid;
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
        .setFooter({ text: 'Use /stats to view your gaming stats!' })
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

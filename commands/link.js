import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { linkAccount, getUser } from '../utils/userData.js';
import { resolveVanityUrl, getSteamProfile } from '../utils/steamAPI.js';
import { getPSNAccountId, getPSNProfile } from '../utils/psnAPI.js';

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

      // ===== STEAM - UNTOUCHED =====
      if (platform === 'steam') {
        try {
          const profile = await getSteamProfile(username);
          accountId = username;
          displayName = profile.personaname;
        } catch {
          try {
            accountId = await resolveVanityUrl(username);
            const profile = await getSteamProfile(accountId);
            displayName = profile.personaname;
          } catch {
            return await interaction.editReply({
              content: '❌ Could not find Steam account. Please provide either your SteamID64 or custom URL name.',
              ephemeral: true
            });
          }
        }
      }

      // ===== PSN - IMPROVED WITH BETTER ERROR MESSAGING =====
      if (platform === 'psn') {
        try {
          console.log(`\n[PSN Link] User input: "${username}"`);
          
          // Fetch the profile (uses exact lookup via getProfileFromUserName)
          const profile = await getPSNProfile(username);
          
          console.log(`[PSN Link] ✅ Profile found - Online ID: "${profile.onlineId}"`);
          console.log(`[PSN Link] Trophy Level: ${profile.trophyLevel}`);

          accountId = profile.onlineId;
          displayName = profile.onlineId;
          
          console.log(`[PSN Link] Storing Online ID: ${accountId}\n`);

        } catch (error) {
          console.error(`[PSN Link] ❌ Failed:`, error.message);
          
          // Better error message with specific troubleshooting
          let errorMsg = `❌ Could not link PSN account.\n\n**Error:** ${error.message}\n\n**Please verify:**\n`;
          
          if (error.message.includes('not found') || error.message.includes('Double-check')) {
            errorMsg += '• Your PSN Online ID is spelled **exactly** as it appears on your profile\n';
            errorMsg += '• Check for capital letters or numbers\n';
            errorMsg += '• Try with different casing if uncertain';
          } else if (error.message.includes('not accessible') || error.message.includes('public')) {
            errorMsg += '• Your PSN profile is set to **Public** (not Private)\n';
            errorMsg += '• Trophies are visible to **"Anyone"** (check privacy settings)\n';
            errorMsg += '• Your profile isn\'t restricted by platform/region';
          } else {
            errorMsg += '• Your PSN Online ID is correct\n';
            errorMsg += '• Your profile is public\n';
            errorMsg += '• Trophies are visible to "Anyone"';
          }
          
          return await interaction.editReply({ content: errorMsg, ephemeral: true });
        }
      }

      // ===== XBOX - UNTOUCHED =====
      if (platform === 'xbox') {
        displayName = username;
      }

      // Save the linked account
      linkAccount(userId, platform, accountId);

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

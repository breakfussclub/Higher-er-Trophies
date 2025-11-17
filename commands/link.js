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

      // For Steam, validate and convert to SteamID64 if needed
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

      // For PSN, fetch the profile using exact Online ID lookup
      if (platform === 'psn') {
        try {
          console.log(`\n=== LINKING PSN ACCOUNT ===`);
          console.log(`User input: "${username}"`);
          
          // Fetch the profile (now using exact lookup!)
          const profile = await getPSNProfile(username);
          
          console.log(`✅ Profile found - Online ID: "${profile.onlineId}"`);
          console.log(`Trophy Level: ${profile.trophyLevel}`);

          // Store the Official Online ID that PSN returned
          accountId = profile.onlineId;
          displayName = profile.onlineId;
          
          console.log(`✅ PSN account validated and ready to store`);
          console.log(`Storing Online ID: ${accountId}\n`);

        } catch (error) {
          console.error(`❌ PSN linking failed:`, error.message);
          return await interaction.editReply({
            content: `❌ Could not link PSN account.\n\n**Error:** ${error.message}\n\n**Please verify:**\n• Your PSN Online ID is spelled correctly\n• Your PSN profile is **public**\n• Your trophies are visible to **"Anyone"**`,
            ephemeral: true
          });
        }
      }

      // For Xbox, we store the gamertag as-is
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

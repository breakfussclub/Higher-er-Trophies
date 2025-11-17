import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { linkAccount, getUser } from '../utils/userData.js';
import { resolveVanityUrl, getSteamProfile } from '../utils/steamAPI.js';
import { getPSNAccountId } from '../utils/psnAPI.js';

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
          // Try to get profile directly (assumes SteamID64)
          const profile = await getSteamProfile(username);
          accountId = username;
          displayName = profile.personaname;
        } catch {
          // If that fails, try resolving as vanity URL
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

      // For PSN, validate and convert Online ID to Account ID if needed
      if (platform === 'psn') {
        try {
          // Check if it's already an account ID (numeric)
          if (/^\d+$/.test(username)) {
            accountId = username;
            displayName = username; // We'll use the account ID as display
          } else {
            // It's an Online ID, need to convert to Account ID
            accountId = await getPSNAccountId(username);
            displayName = username; // Keep the Online ID for display
          }
        } catch (error) {
          return await interaction.editReply({
            content: `❌ Could not find PSN account "${username}". Please check:\n• Username is spelled correctly\n• Profile privacy is set to public\n• Trophies are visible to "Anyone"\n\nError: ${error.message}`,
            ephemeral: true
          });
        }
      }

      // For Xbox, we could add validation here too if needed
      if (platform === 'xbox') {
        // Xbox usernames are stored as-is
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
          { name: 'Username', value: displayName, inline: true },
          { name: 'Account ID', value: accountId, inline: true }
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

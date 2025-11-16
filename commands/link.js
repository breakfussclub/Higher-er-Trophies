import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { linkAccount, getUser } from '../utils/userData.js';
import { resolveVanityUrl, getSteamProfile } from '../utils/steamAPI.js';

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

      // For Steam, validate and convert to SteamID64 if needed
      if (platform === 'steam') {
        try {
          // Try to get profile directly (assumes SteamID64)
          await getSteamProfile(username);
          accountId = username;
        } catch {
          // If that fails, try resolving as vanity URL
          try {
            accountId = await resolveVanityUrl(username);
          } catch {
            return await interaction.editReply({
              content: '❌ Could not find Steam account. Please provide either your SteamID64 or custom URL name.',
              ephemeral: true
            });
          }
        }
      }

      // Save the linked account
      linkAccount(userId, platform, accountId);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Account Linked Successfully')
        .setDescription(`Your **${platform.toUpperCase()}** account has been linked!`)
        .addFields(
          { name: 'Platform', value: platform.toUpperCase(), inline: true },
          { name: 'Username/ID', value: accountId, inline: true }
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

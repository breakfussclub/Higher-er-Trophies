import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { checkNewAchievements, getLastSyncTime } from '../utils/achievementTracker.js';
import { formatAchievementDigest } from '../utils/achievementFormatter.js';
import config from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Manually sync achievements and trophies for all linked users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const lastSync = getLastSyncTime();
      const lastSyncText = lastSync 
        ? `Last sync: <t:${Math.floor(new Date(lastSync).getTime() / 1000)}:R>`
        : 'No previous sync found';

      await interaction.editReply({
        content: `🔄 Starting achievement sync...\n${lastSyncText}`,
        ephemeral: true
      });

      // Check for new achievements
      const newAchievements = await checkNewAchievements();

      // If no new achievements found
      if (Object.keys(newAchievements).length === 0) {
        return await interaction.editReply({
          content: `✅ Sync complete! No new achievements or trophies found.\n${lastSyncText}`,
          ephemeral: true
        });
      }

      // Format and post to achievement channel
      const achievementChannel = interaction.client.channels.cache.get(config.discord.achievementChannelId);
      
      if (!achievementChannel) {
        return await interaction.editReply({
          content: `⚠️ Sync complete and found ${Object.keys(newAchievements).length} user(s) with new achievements, but the achievement channel is not configured or cannot be found.\n\nPlease set ACHIEVEMENT_CHANNEL_ID in your environment variables.`,
          ephemeral: true
        });
      }

      // Send achievement digest to channel
      const embeds = await formatAchievementDigest(newAchievements, interaction.client);
      
      for (const embed of embeds) {
        await achievementChannel.send({ embeds: [embed] });
      }

      await interaction.editReply({
        content: `✅ Sync complete! Found new achievements for ${Object.keys(newAchievements).length} user(s).\n\nPosted to <#${config.discord.achievementChannelId}>`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in sync command:', error);
      await interaction.editReply({
        content: `❌ Error during sync: ${error.message}`,
        ephemeral: true
      });
    }
  }
};

import { SlashCommandBuilder } from 'discord.js';
import { checkNewAchievements } from '../jobs/syncAchievements.js';
import { formatAchievementDigest } from '../utils/achievementFormatter.js';
import config from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Manually trigger achievement sync'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const newAchievements = await checkNewAchievements();

      if (Object.keys(newAchievements).length === 0) {
        return await interaction.editReply('✅ Sync complete. No new achievements found.');
      }

      // Get achievement channel
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

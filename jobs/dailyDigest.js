import { EmbedBuilder } from 'discord.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { generateXboxLeaderboard, generatePSNLeaderboard, generateSteamLeaderboard } from '../commands/leaderboard.js';

export async function postDailyDigest(client) {
    logger.info('📰 Preparing Daily Digest...');

    const channelId = config.discord.achievementChannelId;
    if (!channelId) {
        logger.warn('⚠️ No achievement channel configured for Daily Digest.');
        return;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        logger.error(`❌ Could not find channel with ID ${channelId}`);
        return;
    }

    try {
        const embed = new EmbedBuilder()
            .setTitle('🏆 Daily Leaderboard Digest')
            .setDescription('Here are the current top standings across all platforms!')
            .setColor(0xFFD700) // Gold
            .setTimestamp()
            .setFooter({ text: 'Higher-er Trophies • Daily Update' });

        // Add summaries (Top 3)
        await generateXboxLeaderboard(embed, true);
        await generatePSNLeaderboard(embed, true);
        await generateSteamLeaderboard(embed, true);

        await channel.send({ embeds: [embed] });
        logger.info('✅ Daily Digest posted successfully.');

    } catch (error) {
        logger.error('❌ Error posting Daily Digest:', error);
    }
}

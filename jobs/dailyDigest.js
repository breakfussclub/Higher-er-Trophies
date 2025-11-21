import { EmbedBuilder } from 'discord.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { query } from '../database/db.js';
import { generateGlobalLeaderboard } from '../commands/leaderboard.js';

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
        // 1. Fetch achievements unlocked in the last 24 hours
        const { rows: recentUnlocks } = await query(`
            SELECT a.discord_id, a.platform, a.game_id, a.achievement_id, u.username
            FROM achievements a
            JOIN linked_accounts u ON a.discord_id = u.discord_id AND a.platform = u.platform
            WHERE a.detected_at > NOW() - INTERVAL '24 hours'
        `);

        const embed = new EmbedBuilder()
            .setTitle('📰 Daily Gaming Recap')
            .setDescription('Here is what happened in the last 24 hours!')
            .setColor(0xFFD700)
            .setTimestamp()
            .setFooter({ text: 'Higher-er Trophies • Daily Update' });

        // Group by User -> Game
        if (recentUnlocks.length > 0) {
            const userStats = {};

            for (const unlock of recentUnlocks) {
                if (!userStats[unlock.username]) {
                    userStats[unlock.username] = { count: 0, games: new Set() };
                }
                userStats[unlock.username].count++;
                userStats[unlock.username].games.add(unlock.game_id); // We might want game names here ideally, but ID is what we have in this table
            }

            const recapLines = Object.entries(userStats).map(([username, stats]) => {
                return `**${username}** unlocked **${stats.count}** achievements across ${stats.games.size} game(s).`;
            });

            embed.addFields({
                name: '🔥 Yesterday\'s Activity',
                value: recapLines.join('\n'),
                inline: false
            });
        } else {
            embed.addFields({
                name: '🔥 Yesterday\'s Activity',
                value: 'No achievements unlocked yesterday. Time to get gaming!',
                inline: false
            });
        }

        // 2. Global Leaderboard
        await generateGlobalLeaderboard(embed, true);

        await channel.send({ embeds: [embed] });
        logger.info('✅ Daily Digest posted successfully.');

    } catch (error) {
        logger.error('❌ Error posting Daily Digest:', error);
    }
}

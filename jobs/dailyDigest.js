import { EmbedBuilder } from 'discord.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { query } from '../database/db.js';
import { generateLeaderboard } from '../commands/leaderboard.js';

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
            SELECT a.discord_id, a.platform, a.game_id, a.achievement_id, u.username,
                   a.achievement_name, a.description, a.game_name, a.icon_url
            FROM achievements a
            JOIN linked_accounts u ON a.discord_id = u.discord_id AND a.platform = u.platform
            WHERE a.detected_at > NOW() - INTERVAL '24 hours'
            ORDER BY u.username, a.game_name, a.detected_at DESC
        `);

        const embed = new EmbedBuilder()
            .setTitle('📰 Daily Gaming Recap')
            .setDescription('Here is what happened in the last 24 hours!')
            .setColor(0xFFD700)
            .setTimestamp()
            .setFooter({ text: 'Higher-er Trophies • Daily Update' });

        if (recentUnlocks.length > 0) {
            const userStats = {};

            // Group by User -> Game
            for (const unlock of recentUnlocks) {
                if (!userStats[unlock.username]) {
                    userStats[unlock.username] = {};
                }
                const gameName = unlock.game_name || unlock.game_id;
                if (!userStats[unlock.username][gameName]) {
                    userStats[unlock.username][gameName] = [];
                }

                // Add achievement details
                userStats[unlock.username][gameName].push({
                    name: unlock.achievement_name || 'Unknown Achievement',
                    desc: unlock.description
                });
            }

            // Build the embed fields
            for (const [username, games] of Object.entries(userStats)) {
                let userField = '';

                for (const [gameName, achievements] of Object.entries(games)) {
                    const count = achievements.length;
                    const shown = achievements.slice(0, 5); // Show max 5 per game
                    const remaining = count - 5;

                    userField += `**${gameName}** (${count} new)\n`;

                    shown.forEach(ach => {
                        userField += `> 🏆 **${ach.name}**\n`;
                    });

                    if (remaining > 0) {
                        userField += `> ...and ${remaining} more.\n`;
                    }
                    userField += '\n';
                }

                embed.addFields({
                    name: `🎮 ${username}'s Activity`,
                    value: userField.substring(0, 1024), // Discord limit
                    inline: false
                });
            }

        } else {
            // Fallback: Achievement Spotlight
            const { rows: randomAch } = await query(`
                SELECT a.achievement_name, a.description, a.game_name, a.icon_url, u.username, a.platform
                FROM achievements a
                JOIN linked_accounts u ON a.discord_id = u.discord_id AND a.platform = u.platform
                ORDER BY RANDOM()
                LIMIT 1
            `);

            if (randomAch.length > 0) {
                const ach = randomAch[0];
                embed.setTitle('🏆 Achievement Spotlight')
                    .setDescription('No new achievements in the last 24h, but check this out!')
                    .addFields(
                        { name: 'Game', value: ach.game_name || 'Unknown Game', inline: true },
                        { name: 'Earned By', value: `${ach.username} (${ach.platform.toUpperCase()})`, inline: true },
                        { name: '\u200b', value: '\u200b', inline: true }, // Spacer
                        { name: `🏅 ${ach.achievement_name}`, value: ach.description || 'No description', inline: false }
                    );

                if (ach.icon_url) {
                    embed.setThumbnail(ach.icon_url);
                }
            } else {
                embed.addFields({
                    name: '🔥 Yesterday\'s Activity',
                    value: 'No achievements unlocked yesterday. Time to get gaming!',
                    inline: false
                });
            }
        }

        // 2. Leaderboard Snapshot
        await generateLeaderboard(embed, 3); // Show top 3 per platform for digest

        await channel.send({ embeds: [embed] });
        logger.info('✅ Daily Digest posted successfully.');

    } catch (error) {
        logger.error('❌ Error posting Daily Digest:', error);
    }
}

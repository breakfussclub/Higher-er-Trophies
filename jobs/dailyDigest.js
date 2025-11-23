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
            WHERE a.unlocked_at > NOW() - INTERVAL '24 hours'
            ORDER BY u.username, a.game_name, a.unlocked_at DESC
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
            let totalChars = 0;
            // Estimate initial size (Title + Desc + Footer + Timestamp)
            totalChars += (embed.data.title?.length || 0) + (embed.data.description?.length || 0) + (embed.data.footer?.text?.length || 0) + 50;

            for (const [username, games] of Object.entries(userStats)) {
                if (totalChars > 5500) {
                    embed.setDescription(embed.data.description + '\n\n*(Some activity omitted due to size limits)*');
                    break;
                }

                let userField = '';
                const gameEntries = Object.entries(games);
                // Sort games by activity count (descending) and take top 3
                const sortedGames = gameEntries.sort((a, b) => b[1].length - a[1].length).slice(0, 3);
                const hiddenGamesCount = gameEntries.length - sortedGames.length;

                for (const [gameName, achievements] of sortedGames) {
                    const count = achievements.length;
                    const shown = achievements.slice(0, 5); // Show max 5 per game
                    const remaining = count - 5;

                    let gameBlock = `**${gameName}** (${count} new)\n`;
                    shown.forEach(ach => {
                        gameBlock += `> 🏆 **${ach.name}**\n`;
                    });
                    if (remaining > 0) {
                        gameBlock += `> ...and ${remaining} more.\n`;
                    }
                    gameBlock += '\n';

                    // Check if adding this game block exceeds field limit (1024)
                    if ((userField.length + gameBlock.length) > 1000) {
                        userField += `*(...and more in ${gameName})*\n`;
                        break;
                    }
                    userField += gameBlock;
                }

                if (hiddenGamesCount > 0) {
                    userField += `*...and activity in ${hiddenGamesCount} other game(s).*`;
                }

                const fieldName = `🎮 ${username}'s Activity`;
                const fieldVal = userField.substring(0, 1024);

                // Check total size before adding
                if ((totalChars + fieldName.length + fieldVal.length) < 5900) {
                    embed.addFields({
                        name: fieldName,
                        value: fieldVal,
                        inline: false
                    });
                    totalChars += fieldName.length + fieldVal.length;
                } else {
                    embed.setDescription(embed.data.description + '\n\n*(Some activity omitted due to size limits)*');
                    break;
                }
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

                const spotlightIntros = [
                    "It's been a quiet day for trophies, but let's take a moment to appreciate this gem from the archives!",
                    "The trophy gods are resting today. Instead, let's look back at this epic moment!",
                    "No new shiny things today? No problem! Here's a blast from the past.",
                    "Everyone's taking a break! So here's a random achievement to inspire you.",
                    "Silence on the achievement front... but do you remember when this happened?",
                    "Slow day? Maybe. But this achievement is still pretty cool.",
                    "Nothing new to report today, so let's celebrate this classic unlock instead!"
                ];
                const randomIntro = spotlightIntros[Math.floor(Math.random() * spotlightIntros.length)];

                embed.setTitle('🏆 Achievement Spotlight')
                    .setDescription(randomIntro)
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

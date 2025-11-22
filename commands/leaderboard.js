import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the achievement leaderboard')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Filter by platform')
                .setRequired(false)
                .addChoices(
                    { name: 'Global (Unified Score)', value: 'global' },
                    { name: 'Xbox (Gamerscore)', value: 'xbox' },
                    { name: 'PlayStation (Trophies)', value: 'psn' },
                    { name: 'Steam (Achievements)', value: 'steam' }
                )),

    async execute(interaction) {
        const platformFilter = interaction.options.getString('platform');

        // If no platform specified, show a menu or default to one? 
        // Let's default to showing all 3 in separate fields if no filter, or just error.
        // Better: If no filter, show a summary of top 1 for each? 
        // Let's stick to specific platforms for now to keep it clean, or default to Xbox if that's the main one.
        // Actually, let's just handle each case.

        await interaction.deferReply();

        try {
            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Gold
                .setTimestamp();

            if (platformFilter === 'xbox') {
                await generateXboxLeaderboard(embed);
            } else if (platformFilter === 'psn') {
                await generatePSNLeaderboard(embed);
            } else if (platformFilter === 'steam') {
                await generateSteamLeaderboard(embed);
            } else if (platformFilter === 'global') {
                await generateGlobalLeaderboard(embed);
            } else {
                // Show all
                embed.setTitle('🏆 Global Leaderboards');
                embed.setDescription('Top players across all platforms.');
                await generateXboxLeaderboard(embed, true);
                await generatePSNLeaderboard(embed, true);
                // Steam is hard to rank right now without total count, skipping or showing placeholder
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Leaderboard error:', error);
            await interaction.editReply({ content: '❌ An error occurred while fetching the leaderboard.' });
        }
    }
};

export async function generateXboxLeaderboard(embed, isSummary = false) {
    const { rows } = await query(`
        SELECT u.discord_id, la.username, la.extra_data
        FROM linked_accounts la
        JOIN users u ON la.discord_id = u.discord_id
        WHERE la.platform = 'xbox'
    `);

    // Sort by Gamerscore
    const sorted = rows.sort((a, b) => {
        const scoreA = parseInt(a.extra_data?.gamerscore || 0);
        const scoreB = parseInt(b.extra_data?.gamerscore || 0);
        return scoreB - scoreA;
    });

    const top = isSummary ? sorted.slice(0, 3) : sorted.slice(0, 10);

    if (top.length === 0) {
        if (!isSummary) embed.setDescription('No Xbox accounts linked yet.');
        return;
    }

    const fieldName = isSummary ? '🟢 Xbox Top 3' : '🟢 Xbox Leaderboard';
    const fieldValue = top.map((user, index) => {
        const score = user.extra_data?.gamerscore || 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${user.username}** — ${score.toLocaleString()} Ⓖ`;
    }).join('\n');

    embed.addFields({ name: fieldName, value: fieldValue, inline: false });
}

export async function generatePSNLeaderboard(embed, isSummary = false) {
    const { rows } = await query(`
        SELECT u.discord_id, la.username, la.extra_data
        FROM linked_accounts la
        JOIN users u ON la.discord_id = u.discord_id
        WHERE la.platform = 'psn'
    `);

    // Sort by Trophy Level, then Total Trophies
    const sorted = rows.sort((a, b) => {
        const levelA = parseInt(a.extra_data?.trophyLevel || 0);
        const levelB = parseInt(b.extra_data?.trophyLevel || 0);
        if (levelA !== levelB) return levelB - levelA;

        // Tie breaker: total trophies
        const trophiesA = a.extra_data?.earnedTrophies;
        const totalA = (trophiesA?.platinum || 0) + (trophiesA?.gold || 0) + (trophiesA?.silver || 0) + (trophiesA?.bronze || 0);

        const trophiesB = b.extra_data?.earnedTrophies;
        const totalB = (trophiesB?.platinum || 0) + (trophiesB?.gold || 0) + (trophiesB?.silver || 0) + (trophiesB?.bronze || 0);

        return totalB - totalA;
    });

    const top = isSummary ? sorted.slice(0, 3) : sorted.slice(0, 10);

    if (top.length === 0) {
        if (!isSummary) embed.setDescription('No PSN accounts linked yet.');
        return;
    }

    const fieldName = isSummary ? '🔵 PSN Top 3' : '🔵 PSN Leaderboard';
    const fieldValue = top.map((user, index) => {
        const level = user.extra_data?.trophyLevel || 0;
        const trophies = user.extra_data?.earnedTrophies;
        const plats = trophies?.platinum || 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${user.username}** — Lvl ${level} (${plats} 🏆)`;
    }).join('\n');

    embed.addFields({ name: fieldName, value: fieldValue, inline: false });
}

export async function generateSteamLeaderboard(embed, isSummary = false) {
    const { rows } = await query(`
        SELECT u.discord_id, la.username, la.extra_data
        FROM linked_accounts la
        JOIN users u ON la.discord_id = u.discord_id
        WHERE la.platform = 'steam'
    `);

    // Sort by Steam Level
    const sorted = rows.sort((a, b) => {
        const levelA = parseInt(a.extra_data?.steamLevel || 0);
        const levelB = parseInt(b.extra_data?.steamLevel || 0);
        return levelB - levelA;
    });

    const top = isSummary ? sorted.slice(0, 3) : sorted.slice(0, 10);

    if (top.length === 0) {
        if (!isSummary) embed.setDescription('No Steam accounts linked yet.');
        return;
    }

    const fieldName = isSummary ? '☁️ Steam Top 3' : '☁️ Steam Leaderboard';
    const fieldValue = top.map((user, index) => {
        const level = user.extra_data?.steamLevel || 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${user.username}** — Lvl ${level}`;
    }).join('\n');

    embed.addFields({ name: fieldName, value: fieldValue, inline: false });
}

export async function generateGlobalLeaderboard(embed, isSummary = false) {
    const { rows } = await query(`
        SELECT u.discord_id, 
               json_object_agg(la.platform, la.extra_data) as accounts,
               MAX(la.username) as username
        FROM linked_accounts la
        JOIN users u ON la.discord_id = u.discord_id
        GROUP BY u.discord_id
    `);

    // Calculate Total Score
    const ranked = rows.map(user => {
        const accounts = user.accounts || {};
        let totalScore = 0;

        // Xbox: 1 Gamerscore = 1 Point
        if (accounts.xbox) {
            totalScore += parseInt(accounts.xbox.gamerscore || 0);
        }

        // PSN: Platinum=300, Gold=90, Silver=30, Bronze=15
        if (accounts.psn && accounts.psn.earnedTrophies) {
            const t = accounts.psn.earnedTrophies;
            totalScore += (t.platinum || 0) * 300;
            totalScore += (t.gold || 0) * 90;
            totalScore += (t.silver || 0) * 30;
            totalScore += (t.bronze || 0) * 15;
        }

        // Steam: Level * 500
        if (accounts.steam) {
            totalScore += (parseInt(accounts.steam.steamLevel || 0) * 500);
        }

        return {
            username: user.username || 'Unknown',
            score: totalScore,
            breakdown: {
                xbox: accounts.xbox ? parseInt(accounts.xbox.gamerscore || 0) : 0,
                psn: accounts.psn ? (accounts.psn.trophyLevel || 0) : 0,
                steam: accounts.steam ? (accounts.steam.steamLevel || 0) : 0
            }
        };
    }).sort((a, b) => b.score - a.score);

    const top = isSummary ? ranked.slice(0, 3) : ranked.slice(0, 10); // Show top 3 in summary, 10 in full

    if (top.length === 0) {
        if (!isSummary) embed.setDescription('No accounts linked yet.');
        return;
    }

    const fieldName = isSummary ? '🌍 Global Leaderboard' : '🌍 Global Leaderboard (Top 15)';

    const fieldValue = top.map((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const xb = user.breakdown.xbox.toLocaleString();
        const ps = user.breakdown.psn;
        const st = user.breakdown.steam;

        let line = `${medal} **${user.username}** — **${user.score.toLocaleString()}**`;
        // Add breakdown on next line with indentation
        line += `\n   └─ XB: ${xb} • PS: ${ps} • St: ${st}`;

        return line;
    }).join('\n\n'); // Double newline for spacing

    embed.addFields({ name: fieldName, value: fieldValue, inline: false });
}

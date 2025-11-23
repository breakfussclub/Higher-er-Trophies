import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the global achievement leaderboard'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Gold
                .setTitle('🏆 Higher-er Learning Leaderboard')
                .setDescription('Top players across all platforms.')
                .setTimestamp();

            await generateLeaderboard(embed, 10); // Show top 10 per platform

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
            await interaction.editReply({ content: '❌ An error occurred while fetching the leaderboard.' });
        }
    }
};

export async function generateLeaderboard(embed, limit = 10) {
    // Fetch all data
    const { rows } = await query(`
        SELECT u.discord_id, 
               json_object_agg(la.platform, la.extra_data) as accounts,
               MAX(la.username) as username
        FROM linked_accounts la
        JOIN users u ON la.discord_id = u.discord_id
        GROUP BY u.discord_id
    `);

    // Helper to safely parse extra_data
    const getAccountData = (user, platform) => {
        if (!user.accounts || !user.accounts[platform]) return null;
        let data = user.accounts[platform];
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                return null;
            }
        }
        return data;
    };

    // --- XBOX (Gamerscore) ---
    const xboxRanked = rows
        .map(r => {
            const data = getAccountData(r, 'xbox');
            if (!data) return null;
            return {
                username: r.username,
                score: parseInt(data.gamerscore || 0)
            };
        })
        .filter(r => r !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    let xboxField = 'No data yet.';
    if (xboxRanked.length > 0) {
        // Calculate padding
        const maxNameLen = Math.max(...xboxRanked.map(u => u.username.length));
        xboxField = '```\n';
        xboxField += xboxRanked.map((u, i) => {
            const rank = (i + 1).toString().padEnd(2);
            const name = u.username.padEnd(maxNameLen);
            const score = u.score.toLocaleString().padStart(7);
            return `${rank}. ${name}  ${score} G`;
        }).join('\n');
        xboxField += '\n```';
    }

    // --- PLAYSTATION (Trophies) ---
    const psnRanked = rows
        .map(r => {
            const data = getAccountData(r, 'psn');
            if (!data) return null;
            const t = data.earnedTrophies;
            const total = (t?.platinum || 0) + (t?.gold || 0) + (t?.silver || 0) + (t?.bronze || 0);
            return {
                username: r.username,
                level: data.trophyLevel || 0,
                plats: t?.platinum || 0,
                total: total
            };
        })
        .filter(r => r !== null)
        .sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return b.total - a.total;
        })
        .slice(0, limit);

    let psnField = 'No data yet.';
    if (psnRanked.length > 0) {
        const maxNameLen = Math.max(...psnRanked.map(u => u.username.length));
        psnField = '```\n';
        psnField += psnRanked.map((u, i) => {
            const rank = (i + 1).toString().padEnd(2);
            const name = u.username.padEnd(maxNameLen);
            const level = `Lvl ${u.level}`.padEnd(7);
            const plats = `${u.plats} Plats`;
            return `${rank}. ${name}  ${level}  ${plats}`;
        }).join('\n');
        psnField += '\n```';
    }

    // --- STEAM (Level) ---
    const steamRanked = rows
        .map(r => {
            const data = getAccountData(r, 'steam');
            if (!data) return null;
            return {
                username: r.username,
                level: parseInt(data.steamLevel || 0)
            };
        })
        .filter(r => r !== null)
        .sort((a, b) => b.level - a.level)
        .slice(0, limit);

    let steamField = 'No data yet.';
    if (steamRanked.length > 0) {
        const maxNameLen = Math.max(...steamRanked.map(u => u.username.length));
        steamField = '```\n';
        steamField += steamRanked.map((u, i) => {
            const rank = (i + 1).toString().padEnd(2);
            const name = u.username.padEnd(maxNameLen);
            const level = `Lvl ${u.level}`;
            return `${rank}. ${name}  ${level}`;
        }).join('\n');
        steamField += '\n```';
    }

    // Add fields to embed
    embed.addFields(
        { name: '🟢 Xbox Live', value: xboxField, inline: false },
        { name: '🔵 PlayStation Network', value: psnField, inline: false },
        { name: '☁️ Steam', value: steamField, inline: false }
    );
}

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
                .setThumbnail('attachment://leaderboard_icon.png')
                .setTimestamp();

            await generateLeaderboard(embed, 10); // Show top 10 per platform

            await interaction.editReply({
                embeds: [embed],
                files: ['./assets/leaderboard_icon.png']
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
            await interaction.editReply({ content: '❌ An error occurred while fetching the leaderboard.' });
        }
    }
};

export async function generateLeaderboard(embed, limit = 5) {
    // Fetch all data
    const { rows } = await query(`
        SELECT u.discord_id, 
               json_object_agg(la.platform, la.extra_data) as accounts,
               MAX(la.username) as username
        FROM linked_accounts la
        JOIN users u ON la.discord_id = u.discord_id
        GROUP BY u.discord_id
    `);

    // --- XBOX (Gamerscore) ---
    const xboxRanked = rows
        .filter(r => r.accounts.xbox)
        .map(r => ({
            username: r.username,
            score: parseInt(r.accounts.xbox.gamerscore || 0)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    let xboxField = 'No data yet.';
    if (xboxRanked.length > 0) {
        xboxField = xboxRanked.map((u, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            return `${medal} **${u.username}** — ${u.score.toLocaleString()} Ⓖ`;
        }).join('\n');
    }

    // --- PLAYSTATION (Trophies) ---
    const psnRanked = rows
        .filter(r => r.accounts.psn)
        .map(r => {
            const t = r.accounts.psn.earnedTrophies;
            const total = (t?.platinum || 0) + (t?.gold || 0) + (t?.silver || 0) + (t?.bronze || 0);
            return {
                username: r.username,
                level: r.accounts.psn.trophyLevel || 0,
                plats: t?.platinum || 0,
                total: total
            };
        })
        .sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return b.total - a.total;
        })
        .slice(0, limit);

    let psnField = 'No data yet.';
    if (psnRanked.length > 0) {
        psnField = psnRanked.map((u, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            return `${medal} **${u.username}** — Lvl ${u.level} (${u.plats} 🏆)`;
        }).join('\n');
    }

    // --- STEAM (Level) ---
    const steamRanked = rows
        .filter(r => r.accounts.steam)
        .map(r => ({
            username: r.username,
            level: parseInt(r.accounts.steam.steamLevel || 0)
        }))
        .sort((a, b) => b.level - a.level)
        .slice(0, limit);

    let steamField = 'No data yet.';
    if (steamRanked.length > 0) {
        steamField = steamRanked.map((u, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
            return `${medal} **${u.username}** — Lvl ${u.level}`;
        }).join('\n');
    }

    // Add fields to embed
    embed.addFields(
        { name: '🟢 Xbox Live', value: xboxField, inline: false },
        { name: '🔵 PlayStation Network', value: psnField, inline: false },
        { name: '☁️ Steam', value: steamField, inline: false }
    );
}

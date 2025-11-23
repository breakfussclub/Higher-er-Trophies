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
                .setTitle('🏆 Global Leaderboard')
                .setDescription('Top players across all platforms (Xbox, PSN, Steam)')
                .setTimestamp();

            await generateUnifiedLeaderboard(embed);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Leaderboard error:', error);
            await interaction.editReply({ content: '❌ An error occurred while fetching the leaderboard.' });
        }
    }
};

export async function generateUnifiedLeaderboard(embed, limit = 15) {
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

    const top = ranked.slice(0, limit);

    if (top.length === 0) {
        embed.setDescription('No accounts linked yet. Use `/link` to join the leaderboard!');
        return;
    }

    const leaderboardList = top.map((user, index) => {
        let medal = `**${index + 1}.**`;
        if (index === 0) medal = '🥇';
        if (index === 1) medal = '🥈';
        if (index === 2) medal = '🥉';

        const xb = user.breakdown.xbox > 0 ? `XB: ${user.breakdown.xbox.toLocaleString()}` : '';
        const ps = user.breakdown.psn > 0 ? `PS Lvl: ${user.breakdown.psn}` : '';
        const st = user.breakdown.steam > 0 ? `Steam Lvl: ${user.breakdown.steam}` : '';

        const breakdownParts = [xb, ps, st].filter(p => p !== '').join(' • ');
        const breakdownDisplay = breakdownParts ? `\n      └─ ${breakdownParts}` : '';

        return `${medal} **${user.username}** — **${user.score.toLocaleString()}** pts${breakdownDisplay}`;
    }).join('\n\n');

    embed.addFields({ name: '\u200b', value: leaderboardList, inline: false });

    // Add legend footer
    embed.setFooter({ text: 'Points: 1 Gamerscore = 1 pt • PSN Trophies (Plat=300, Gold=90...) • Steam Level * 500' });
}

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
import { getSteamLevel } from '../services/steamService.js';
import { getPSNProfile } from '../services/psnService.js';
import { getXboxProfile } from '../services/xboxService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare your gaming stats with another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to compare with')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const user1 = interaction.user;
        const user2 = interaction.options.getUser('user');

        if (user1.id === user2.id) {
            return await interaction.editReply('❌ You cannot compare stats with yourself!');
        }

        // Fetch linked accounts for both users
        const { rows } = await query(
            'SELECT discord_id, platform, account_id, extra_data FROM linked_accounts WHERE discord_id IN ($1, $2)',
            [user1.id, user2.id]
        );

        const data1 = { steam: null, psn: null, xbox: null };
        const data2 = { steam: null, psn: null, xbox: null };

        rows.forEach(row => {
            if (row.discord_id === user1.id) data1[row.platform] = row;
            if (row.discord_id === user2.id) data2[row.platform] = row;
        });

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Tale of the Tape')
            .setDescription(`**${user1.username}** vs **${user2.username}**`)
            .setColor(0xFF0000)
            .setTimestamp();

        let hasComparison = false;

        // --- Xbox Comparison ---
        if (data1.xbox && data2.xbox) {
            try {
                const p1 = await getXboxProfile(data1.xbox.account_id); // account_id is gamertag
                const p2 = await getXboxProfile(data2.xbox.account_id);

                const score1 = p1.gamerscore || 0;
                const score2 = p2.gamerscore || 0;
                const diff = score1 - score2;

                const winner = score1 > score2 ? user1.username : (score2 > score1 ? user2.username : 'Tie');
                const icon = score1 > score2 ? '⬅️' : (score2 > score1 ? '➡️' : '🤝');

                embed.addFields({
                    name: '<:xbox:1309308502392934442> Xbox Gamerscore',
                    value: `**${score1.toLocaleString()}** vs **${score2.toLocaleString()}**\n${icon} **${winner}** leads by ${Math.abs(diff).toLocaleString()}`,
                    inline: false
                });
                hasComparison = true;
            } catch (e) {
                console.error('Xbox compare error', e);
            }
        }

        // --- PSN Comparison ---
        if (data1.psn && data2.psn) {
            try {
                const p1 = await getPSNProfile(data1.psn.account_id);
                const p2 = await getPSNProfile(data2.psn.account_id);

                const level1 = p1.trophyLevel || 0;
                const level2 = p2.trophyLevel || 0;

                // Total Trophies
                const t1 = (p1.earnedTrophies?.platinum || 0) + (p1.earnedTrophies?.gold || 0) + (p1.earnedTrophies?.silver || 0) + (p1.earnedTrophies?.bronze || 0);
                const t2 = (p2.earnedTrophies?.platinum || 0) + (p2.earnedTrophies?.gold || 0) + (p2.earnedTrophies?.silver || 0) + (p2.earnedTrophies?.bronze || 0);

                const winner = level1 > level2 ? user1.username : (level2 > level1 ? user2.username : 'Tie');
                const icon = level1 > level2 ? '⬅️' : (level2 > level1 ? '➡️' : '🤝');

                embed.addFields({
                    name: '<:psn:1309308499209584691> PSN Trophies',
                    value: `Level **${level1}** (${t1} 🏆) vs Level **${level2}** (${t2} 🏆)\n${icon} **${winner}** is higher level`,
                    inline: false
                });
                hasComparison = true;
            } catch (e) {
                console.error('PSN compare error', e);
            }
        }

        // --- Steam Comparison ---
        if (data1.steam && data2.steam) {
            try {
                // Need to resolve steam IDs if they are vanity URLs? 
                // Usually account_id is the ID we use for lookups. 
                // But wait, for Steam we store the ID in account_id usually? 
                // Or do we store vanity? 
                // In link.js we resolve it. So account_id should be SteamID64.
                // But let's check extra_data just in case.
                const id1 = data1.steam.extra_data?.steamId64 || data1.steam.account_id;
                const id2 = data2.steam.extra_data?.steamId64 || data2.steam.account_id;

                const l1Data = await getSteamLevel(id1);
                const l2Data = await getSteamLevel(id2);

                const level1 = l1Data?.player_level || 0;
                const level2 = l2Data?.player_level || 0;

                const winner = level1 > level2 ? user1.username : (level2 > level1 ? user2.username : 'Tie');
                const icon = level1 > level2 ? '⬅️' : (level2 > level1 ? '➡️' : '🤝');

                embed.addFields({
                    name: '💻 Steam Level',
                    value: `Level **${level1}** vs Level **${level2}**\n${icon} **${winner}** is higher level`,
                    inline: false
                });
                hasComparison = true;
            } catch (e) {
                console.error('Steam compare error', e);
            }
        }

        if (!hasComparison) {
            return await interaction.editReply('❌ No common platforms found to compare! Make sure you both have linked accounts for the same platform.');
        }

        await interaction.editReply({ embeds: [embed] });
    }
};

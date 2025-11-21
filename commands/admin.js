import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
import { resolveVanityUrl, getSteamProfile } from '../services/steamService.js';
import { getPSNAccountId, getPSNProfile } from '../services/psnService.js';
import { searchGamertag } from '../services/xboxService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Administrative commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Link a gaming account for another user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The Discord user to link')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('platform')
                        .setDescription('Gaming platform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Steam', value: 'steam' },
                            { name: 'PlayStation Network', value: 'psn' },
                            { name: 'Xbox Live', value: 'xbox' }
                        ))
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('The username/ID on the platform')
                        .setRequired(true))),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'link') {
            await handleAdminLink(interaction);
        }
    }
};

async function handleAdminLink(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const platform = interaction.options.getString('platform');
    const username = interaction.options.getString('username');
    const userId = targetUser.id;

    try {
        let accountId = username;
        let displayName = username;
        let extraData = {};

        // ===== STEAM =====
        if (platform === 'steam') {
            try {
                const profile = await getSteamProfile(username);
                accountId = username;
                displayName = profile.personaname;
                extraData.steamId64 = profile.steamid;
            } catch {
                try {
                    accountId = await resolveVanityUrl(username);
                    const profile = await getSteamProfile(accountId);
                    displayName = profile.personaname;
                    extraData.steamId64 = profile.steamid;
                } catch {
                    return await interaction.editReply(`❌ Could not find Steam user "${username}".`);
                }
            }
        }

        // ===== PSN =====
        else if (platform === 'psn') {
            try {
                const searchResult = await getPSNAccountId(username);
                accountId = searchResult.accountId;
                displayName = searchResult.onlineId;
                extraData.accountId = searchResult.accountId;

                // Fetch full profile for leaderboard data
                try {
                    const profile = await getPSNProfile(accountId);
                    if (profile) {
                        extraData.trophyLevel = profile.trophyLevel;
                        extraData.earnedTrophies = profile.earnedTrophies;
                        extraData.avatarUrl = profile.avatarUrl;
                    }
                } catch (e) {
                    console.warn('Could not fetch PSN profile details for leaderboard:', e.message);
                }

            } catch (error) {
                return await interaction.editReply(`❌ ${error.message}`);
            }
        }

        // ===== XBOX =====
        else if (platform === 'xbox') {
            try {
                const searchResult = await searchGamertag(username);
                accountId = username; // We store Gamertag as the main ID for Xbox usually, or XUID? 
                // In link.js we stored username as accountId? Let's check. 
                // link.js: accountId = username; extraData.xuid = searchResult.xuid;
                // Yes, that matches.

                displayName = username; // Xbox search doesn't always return capitalization, but we can assume input is close enough or use search result if available
                // searchGamertag returns { xuid, gamertag, ... } usually? 
                // services/xboxService.js searchGamertag returns data.people[0] which has xuid and gamertag
                if (searchResult.gamertag) displayName = searchResult.gamertag;

                extraData.xuid = searchResult.xuid;
                extraData.gamertag = displayName;

            } catch (error) {
                return await interaction.editReply(`❌ Could not find Xbox gamertag "${username}".`);
            }
        }

        // Insert into Database
        // 1. Ensure user exists
        await query(
            `INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT (discord_id) DO NOTHING`,
            [userId]
        );

        // 2. Insert/Update Linked Account
        await query(
            `INSERT INTO linked_accounts (discord_id, platform, account_id, username, extra_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (discord_id, platform) 
       DO UPDATE SET account_id = $3, username = $4, extra_data = $5, created_at = CURRENT_TIMESTAMP`,
            [userId, platform, accountId, displayName, extraData]
        );

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Admin Link Successful')
            .setDescription(`Successfully linked **${platform.toUpperCase()}** account for ${targetUser}.`)
            .addFields(
                { name: 'Discord User', value: `${targetUser.tag}`, inline: true },
                { name: 'Platform', value: platform.toUpperCase(), inline: true },
                { name: 'Account', value: displayName, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Admin Link Error:', error);
        await interaction.editReply({ content: '❌ An error occurred while linking the account.' });
    }
}

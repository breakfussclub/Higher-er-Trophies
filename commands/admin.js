import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { query } from '../database/db.js';
import { resolveVanityUrl, getSteamProfile } from '../services/steamService.js';
import { getPSNAccountId, getPSNProfile } from '../services/psnService.js';
import { searchGamertag } from '../services/xboxService.js';
import { postDailyDigest } from '../jobs/dailyDigest.js';

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
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setDescription('Unlink a specific platform for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The Discord user to unlink')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('platform')
                        .setDescription('Gaming platform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Steam', value: 'steam' },
                            { name: 'PlayStation Network', value: 'psn' },
                            { name: 'Xbox Live', value: 'xbox' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink-all')
                .setDescription('Unlink ALL platforms for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The Discord user to unlink all accounts for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear-db')
                .setDescription('⚠️ DANGER: Wipe the entire database (Users, Links, Achievements)')
                .addBooleanOption(option =>
                    option.setName('confirm')
                        .setDescription('You must set this to True to execute')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('digest')
                .setDescription('Manually trigger the Daily Digest post')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'link') {
            await handleAdminLink(interaction);
        } else if (subcommand === 'unlink') {
            await handleAdminUnlink(interaction);
        } else if (subcommand === 'unlink-all') {
            await handleAdminUnlinkAll(interaction);
        } else if (subcommand === 'clear-db') {
            await handleClearDB(interaction);
        } else if (subcommand === 'digest') {
            await handleDigest(interaction);
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
                accountId = username;
                if (searchResult.gamertag) displayName = searchResult.gamertag;

                extraData.xuid = searchResult.xuid;
                extraData.gamertag = displayName;

            } catch (error) {
                return await interaction.editReply(`❌ Could not find Xbox gamertag "${username}".`);
            }
        }

        // Insert into Database
        await query(
            `INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT (discord_id) DO NOTHING`,
            [userId]
        );

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

async function handleAdminUnlink(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('user');
    const platform = interaction.options.getString('platform');

    try {
        const result = await query(
            'DELETE FROM linked_accounts WHERE discord_id = $1 AND platform = $2 RETURNING *',
            [targetUser.id, platform]
        );

        if (result.rowCount === 0) {
            return await interaction.editReply(`❌ ${targetUser} does not have a **${platform.toUpperCase()}** account linked.`);
        }

        // Also delete achievements for this user/platform
        await query(
            'DELETE FROM achievements WHERE discord_id = $1 AND platform = $2',
            [targetUser.id, platform]
        );

        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🔗 Account Unlinked')
            .setDescription(`Successfully unlinked **${platform.toUpperCase()}** for ${targetUser}.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Admin Unlink Error:', error);
        await interaction.editReply('❌ An error occurred while unlinking the account.');
    }
}

async function handleAdminUnlinkAll(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('user');

    try {
        const result = await query(
            'DELETE FROM linked_accounts WHERE discord_id = $1 RETURNING *',
            [targetUser.id]
        );

        if (result.rowCount === 0) {
            return await interaction.editReply(`❌ ${targetUser} has no linked accounts.`);
        }

        // Also delete achievements
        await query(
            'DELETE FROM achievements WHERE discord_id = $1',
            [targetUser.id]
        );

        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🔗 All Accounts Unlinked')
            .setDescription(`Successfully unlinked **ALL** accounts for ${targetUser}.`)
            .addFields({ name: 'Accounts Removed', value: result.rowCount.toString(), inline: true })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Admin Unlink All Error:', error);
        await interaction.editReply('❌ An error occurred while unlinking accounts.');
    }
}

async function handleClearDB(interaction) {
    const confirm = interaction.options.getBoolean('confirm');
    if (!confirm) {
        return await interaction.reply({ content: '❌ You must set `confirm` to True to execute this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Delete in order of dependencies (though CASCADE should handle it, explicit is safer/clearer)
        await query('TRUNCATE TABLE achievements CASCADE');
        await query('TRUNCATE TABLE linked_accounts CASCADE');
        await query('TRUNCATE TABLE users CASCADE');

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ DATABASE CLEARED')
            .setDescription('All users, linked accounts, and achievements have been wiped.')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Clear DB Error:', error);
        await interaction.editReply('❌ An error occurred while clearing the database.');
    }
}

async function handleDigest(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        await postDailyDigest(interaction.client);
        await interaction.editReply('✅ Manually triggered Daily Digest.');
    } catch (error) {
        console.error('Manual Digest Error:', error);
        await interaction.editReply('❌ Failed to trigger Daily Digest.');
    }
}

import { query } from '../database/db.js';
import * as SteamService from '../services/steamService.js';
import * as PSNService from '../services/psnService.js';
import * as XboxService from '../services/xboxService.js';
import logger from '../utils/logger.js';

/**
 * Get all users with linked accounts
 */
async function getAllUsers() {
    const { rows } = await query(`
    SELECT u.discord_id, 
           json_object_agg(la.platform, json_build_object(
             'accountId', la.account_id,
             'extraData', la.extra_data
           )) as accounts
    FROM users u
    LEFT JOIN linked_accounts la ON u.discord_id = la.discord_id
    GROUP BY u.discord_id
  `);
    return rows;
}

/**
 * Check if achievement exists in DB
 */
async function isAchievementLogged(discordId, platform, gameId, achievementId) {
    const { rows } = await query(
        `SELECT 1 FROM achievements 
     WHERE discord_id = $1 AND platform = $2 AND game_id = $3 AND achievement_id = $4`,
        [discordId, platform, gameId.toString(), achievementId.toString()]
    );
    return rows.length > 0;
}

/**
 * Log achievement to DB
 */
async function logAchievement(discordId, platform, gameId, achievementId, unlockedAt) {
    await query(
        `INSERT INTO achievements (discord_id, platform, game_id, achievement_id, unlocked_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (discord_id, platform, game_id, achievement_id) DO NOTHING`,
        [discordId, platform, gameId.toString(), achievementId.toString(), unlockedAt ? new Date(unlockedAt * 1000) : null]
    );
}

/**
 * Check Steam Achievements
 */
async function checkSteam(discordId, steamAccount) {
    const newAchievements = [];
    const steamId = steamAccount.extraData?.steamId64 || steamAccount.accountId;

    try {
        const games = await SteamService.getSteamGames(steamId);
        if (!games.games) return [];

        // Check top 5 recently played or most played
        const topGames = games.games
            .sort((a, b) => b.playtime_forever - a.playtime_forever)
            .slice(0, 5);

        for (const game of topGames) {
            const playerStats = await SteamService.getPlayerAchievements(steamId, game.appid);
            if (!playerStats?.achievements) continue;

            const unlocked = playerStats.achievements.filter(a => a.achieved === 1);
            if (unlocked.length === 0) continue;

            // Check which ones are new
            const trulyNew = [];
            for (const ach of unlocked) {
                const isLogged = await isAchievementLogged(discordId, 'steam', game.appid, ach.apiname);
                if (!isLogged) {
                    trulyNew.push(ach);
                }
            }

            if (trulyNew.length > 0) {
                // Fetch schema for details
                const schema = await SteamService.getAchievementSchema(game.appid);

                for (const ach of trulyNew) {
                    const details = schema?.availableGameStats?.achievements?.find(s => s.name === ach.apiname);

                    newAchievements.push({
                        id: `${game.appid}_${ach.apiname}`,
                        name: details?.displayName || ach.apiname,
                        description: details?.description || 'Achievement unlocked',
                        unlockTime: ach.unlocktime,
                        gameName: game.name,
                        gameId: game.appid,
                        icon: details?.icon || null
                    });

                    // Log it
                    await logAchievement(discordId, 'steam', game.appid, ach.apiname, ach.unlocktime);
                }
            }
        }
    } catch (error) {
        logger.error(`[Sync] Error checking Steam for ${discordId}: ${error.message}`);
    }

    return newAchievements;
}

/**
 * Check PSN Trophies
 */
async function checkPSN(discordId, psnAccount) {
    const newTrophies = [];
    const accountId = psnAccount.extraData?.accountId || psnAccount.accountId; // Should be accountId from DB

    try {
        // If we don't have the numeric accountId, we might need to fetch it, but migration should have handled it.
        // If accountId is username, we might fail here if not cached.
        // Assuming migration/link stored the numeric ID in extraData or accountId.

        const titlesResponse = await PSNService.getPSNUserTitles(accountId);
        if (!titlesResponse?.trophyTitles) return [];

        for (const title of titlesResponse.trophyTitles.slice(0, 5)) {
            if (!title.earnedTrophies || title.earnedTrophies.earned === 0) continue;

            const earnedResponse = await PSNService.getPSNTitleTrophies(accountId, title.npCommunicationId);
            if (!earnedResponse?.trophies) continue;

            const userEarned = earnedResponse.trophies.filter(t => t.earned);

            const trulyNew = [];
            for (const trophy of userEarned) {
                const isLogged = await isAchievementLogged(discordId, 'psn', title.npCommunicationId, trophy.trophyId);
                if (!isLogged) {
                    trulyNew.push(trophy);
                }
            }

            if (trulyNew.length > 0) {
                const gameData = await PSNService.getPSNGameTrophies(title.npCommunicationId);
                const trophyMap = new Map(gameData?.trophies?.map(t => [t.trophyId, t]) || []);

                for (const trophy of trulyNew) {
                    const staticData = trophyMap.get(trophy.trophyId);

                    newTrophies.push({
                        id: `${title.npCommunicationId}_${trophy.trophyId}`,
                        name: staticData?.trophyName || 'Unknown Trophy',
                        description: staticData?.trophyDetail || '',
                        unlockTime: trophy.earnedDateTime ? new Date(trophy.earnedDateTime).getTime() / 1000 : null,
                        gameName: title.trophyTitleName || 'Unknown Game',
                        gameIcon: title.trophyTitleIconUrl || null,
                        gameId: title.npCommunicationId,
                        type: trophy.trophyType,
                        rarity: trophy.trophyEarnedRate,
                        icon: staticData?.trophyIconUrl || null
                    });

                    await logAchievement(discordId, 'psn', title.npCommunicationId, trophy.trophyId, newTrophies[newTrophies.length - 1].unlockTime);
                }
            }
        }
    } catch (error) {
        logger.error(`[Sync] Error checking PSN for ${discordId}: ${error.message}`);
    }

    return newTrophies;
}

/**
 * Check Xbox Achievements
 */
async function checkXbox(discordId, xboxAccount) {
    const newAchievements = [];
    const xuid = xboxAccount.extraData?.xuid;

    if (!xuid) {
        // If we don't have XUID, we can't check. Migration should have it.
        // Or we could try to fetch it if we have the gamertag.
        return [];
    }

    try {
        const achievements = await XboxService.getXboxAchievements(xuid);
        if (!achievements?.titles) return [];

        const sortedTitles = achievements.titles.sort((a, b) => {
            const timeA = new Date(a.lastUnlock || a.lastPlayed || 0).getTime();
            const timeB = new Date(b.lastUnlock || b.lastPlayed || 0).getTime();
            return timeB - timeA;
        });

        for (const title of sortedTitles.slice(0, 5)) {
            const titleAchievements = await XboxService.getTitleAchievements(title.titleId, xuid);
            if (!titleAchievements?.achievements) continue;

            const unlocked = titleAchievements.achievements.filter(a =>
                a.progressState === 'Achieved' || a.progression?.achieved === true || a.achieved === true || a.timeUnlocked
            );

            const trulyNew = [];
            for (const ach of unlocked) {
                // Xbox IDs can be numeric or string
                const achId = ach.id || ach.achievementId || ach.name;
                const isLogged = await isAchievementLogged(discordId, 'xbox', title.titleId, achId);
                if (!isLogged) {
                    trulyNew.push(ach);
                }
            }

            if (trulyNew.length > 0) {
                for (const ach of trulyNew) {
                    const achId = ach.id || ach.achievementId || ach.name;
                    const unlockTime = ach.timeUnlocked || ach.unlockTime || ach.progression?.timeUnlocked;

                    // Filter invalid dates (pre-2005)
                    let validUnlockTime = null;
                    if (unlockTime) {
                        const date = new Date(unlockTime);
                        if (date.getFullYear() >= 2005) {
                            validUnlockTime = date.getTime() / 1000;
                        }
                    }

                    newAchievements.push({
                        id: `${title.titleId}_${achId}`,
                        name: ach.name || ach.achievementName || 'Unknown Achievement',
                        description: ach.description || ach.lockedDescription || '',
                        unlockTime: validUnlockTime,
                        gameName: title.name || title.titleName || 'Unknown Game',
                        gameId: title.titleId,
                        gameIcon: title.displayImage || null,
                        gamerscore: ach.rewards?.[0]?.value || ach.gamerscore || 0,
                        icon: ach.mediaAssets?.[0]?.url || null
                    });

                    await logAchievement(discordId, 'xbox', title.titleId, achId, validUnlockTime);
                }
            }
        }
    } catch (error) {
        logger.error(`[Sync] Error checking Xbox for ${discordId}: ${error.message}`);
    }

    return newAchievements;
}

/**
 * Main Sync Function
 */
export async function checkNewAchievements() {
    logger.info('🔄 Checking for new achievements...');
    const users = await getAllUsers();
    const allNewAchievements = {};

    for (const user of users) {
        const userNew = { steam: [], psn: [], xbox: [] };
        const accounts = user.accounts || {};

        if (accounts.steam) {
            userNew.steam = await checkSteam(user.discord_id, accounts.steam);
        }
        if (accounts.psn) {
            userNew.psn = await checkPSN(user.discord_id, accounts.psn);
        }
        if (accounts.xbox) {
            userNew.xbox = await checkXbox(user.discord_id, accounts.xbox);
        }

        if (userNew.steam.length > 0 || userNew.psn.length > 0 || userNew.xbox.length > 0) {
            allNewAchievements[user.discord_id] = userNew;
        }
    }

    return allNewAchievements;
}

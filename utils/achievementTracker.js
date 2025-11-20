import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from './userData.js';
import { getSteamProfile, getPlayerAchievements, getAchievementSchema, getSteamGames } from './steamAPI.js';
import { getPSNProfile, getPSNUserTitles, getPSNTitleTrophies, getPSNGameTrophies } from './psnAPI.js';
import { getXboxProfile, searchGamertag, getXboxAchievements, getRecentAchievements, getTitleAchievements } from './xboxAPI.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACHIEVEMENT_DATA_FILE = join(__dirname, '../data/achievements.json');

/**
 * Initialize achievement data file
 */
function initAchievementFile() {
  if (!existsSync(ACHIEVEMENT_DATA_FILE)) {
    writeFileSync(ACHIEVEMENT_DATA_FILE, JSON.stringify({
      lastSync: null,
      users: {}
    }, null, 2));
  }
}

/**
 * Read achievement data
 */
function readAchievementData() {
  initAchievementFile();
  const data = readFileSync(ACHIEVEMENT_DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write achievement data
 */
function writeAchievementData(data) {
  writeFileSync(ACHIEVEMENT_DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get Steam achievements for a user
 */
async function getSteamAchievements(steamId) {
  try {
    console.log(`[Steam] Fetching games for Steam ID: ${steamId}`);
    const games = await getSteamGames(steamId);
    if (!games.games || games.games.length === 0) {
      console.log('[Steam] No games found');
      return [];
    }

    const newAchievements = [];

    // Check top 5 most played games for new achievements
    const topGames = games.games
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 5);

    console.log(`[Steam] Checking achievements for top ${topGames.length} games`);

    for (const game of topGames) {
      try {
        console.log(`[Steam] Fetching achievements for: ${game.name} (${game.appid})`);

        const achievements = await getPlayerAchievements(steamId, game.appid);
        const schema = await getAchievementSchema(game.appid);

        // Log what we received
        console.log(`[Steam] ${game.name} - Player achievements:`, achievements?.achievements ? `${achievements.achievements.length} total` : 'none');
        console.log(`[Steam] ${game.name} - Schema achievements:`, schema?.availableGameStats?.achievements ? `${schema.availableGameStats.achievements.length} total` : 'none');

        if (!achievements?.achievements) {
          console.log(`[Steam] ${game.name} - No player achievement data, skipping`);
          continue;
        }

        if (!schema?.availableGameStats?.achievements) {
          console.log(`[Steam] ${game.name} - No schema data available, using basic info only`);

          // Still process achievements even without schema, use basic info
          const unlockedAchievements = achievements.achievements
            .filter(a => a.achieved === 1)
            .map(a => ({
              id: `${game.appid}_${a.apiname}`,
              name: a.apiname, // Use API name as fallback
              description: 'Achievement unlocked', // Generic description
              unlockTime: a.unlocktime,
              gameName: game.name,
              gameId: game.appid,
              icon: null
            }));

          console.log(`[Steam] ${game.name} - Found ${unlockedAchievements.length} unlocked achievements (no schema)`);
          newAchievements.push(...unlockedAchievements);
          continue;
        }

        // Process with full schema data
        const unlockedAchievements = achievements.achievements
          .filter(a => a.achieved === 1)
          .map(a => {
            const details = schema.availableGameStats.achievements.find(s => s.name === a.apiname);

            if (!details) {
              console.log(`[Steam] ${game.name} - No schema details for achievement: ${a.apiname}`);
            }

            return {
              id: `${game.appid}_${a.apiname}`,
              name: details?.displayName || a.apiname,
              description: details?.description || 'Achievement unlocked',
              unlockTime: a.unlocktime,
              gameName: game.name,
              gameId: game.appid,
              icon: details?.icon || null
            };
          });

        console.log(`[Steam] ${game.name} - Found ${unlockedAchievements.length} unlocked achievements with details`);
        newAchievements.push(...unlockedAchievements);

      } catch (err) {
        console.error(`[Steam] Error fetching achievements for ${game.name} (${game.appid}):`, err.message);
      }
    }

    console.log(`[Steam] Total achievements found: ${newAchievements.length}`);
    return newAchievements;
  } catch (error) {
    console.error('[Steam] Error fetching Steam achievements:', error.message);
    return [];
  }
}

/**
 * Get PSN trophies for a user (summary only - detailed trophy fetching requires game-specific calls)
 */
/**
 * Get PSN trophies for a user (individual trophies)
 */
async function getPSNTrophies(psnId) {
  try {
    // First get the profile to resolve "me" or username to accountId
    const profile = await getPSNProfile(psnId);
    const accountId = profile.accountId;

    // Get recent titles
    const titlesResponse = await getPSNUserTitles(accountId);
    if (!titlesResponse?.trophyTitles) return [];

    const newTrophies = [];

    // Check top 5 most recent games
    // PSN returns titles sorted by last updated by default usually, but let's be safe
    const recentTitles = titlesResponse.trophyTitles.slice(0, 5);

    for (const title of recentTitles) {
      try {
        // Skip if no trophies earned
        if (!title.earnedTrophies || title.earnedTrophies.earned === 0) continue;

        // 1. Get user's earned status
        const earnedResponse = await getPSNTitleTrophies(accountId, title.npCommunicationId);
        if (!earnedResponse?.trophies) continue;

        // Filter to only earned trophies first to save API calls if possible (though we need metadata)
        const userEarnedTrophies = earnedResponse.trophies.filter(t => t.earned);
        if (userEarnedTrophies.length === 0) continue;

        // 2. Get static game data (names, descriptions)
        // We only need this if we have earned trophies to report
        const gameDataResponse = await getPSNGameTrophies(title.npCommunicationId);
        if (!gameDataResponse?.trophies) {
          console.log(`Could not fetch game metadata for ${title.npCommunicationId}`);
          continue;
        }

        // Map static data by trophy ID for easy lookup
        const trophyMap = new Map(
          gameDataResponse.trophies.map(t => [t.trophyId, t])
        );

        const earnedTrophies = userEarnedTrophies.map(t => {
          const staticData = trophyMap.get(t.trophyId);
          return {
            id: `${title.npCommunicationId}_${t.trophyId}`,
            name: staticData?.trophyName || 'Unknown Trophy',
            description: staticData?.trophyDetail || '',
            unlockTime: t.earnedDateTime ? new Date(t.earnedDateTime).getTime() / 1000 : null,
            gameName: title.trophyTitleName || 'Unknown Game',
            gameIcon: title.trophyTitleIconUrl || null,
            gameId: title.npCommunicationId,
            type: t.trophyType,
            rarity: t.trophyEarnedRate,
            icon: staticData?.trophyIconUrl || null
          };
        });

        newTrophies.push(...earnedTrophies);
      } catch (err) {
        console.log(`Could not fetch trophies for game ${title.npCommunicationId}:`, err.message);
      }
    }

    return newTrophies;
  } catch (error) {
    console.error('Error fetching PSN trophies:', error.message);
    return [];
  }
}

/**
 * Get Xbox achievements for a user
 */
async function getXboxAchievementsData(gamertag) {
  try {
    console.log(`[Xbox] Searching for gamertag: ${gamertag}`);
    const searchResult = await searchGamertag(gamertag);
    const xuid = searchResult.xuid;
    console.log(`[Xbox] Found XUID: ${xuid}`);

    // Skip broken recent achievements endpoint and go straight to player achievements
    // The recent achievements endpoint (v2) seems to be unstable or requires different params
    console.log(`[Xbox] Fetching player achievements (titles)...`);
    let achievements = await getXboxAchievements(xuid);

    // Parse achievement data if available
    if (!achievements?.titles || achievements.titles.length === 0) {
      console.log('[Xbox] No Xbox titles/achievements found in response');
      console.log('[Xbox] This may be due to API tier limitations or privacy settings');
      return [];
    }

    console.log(`[Xbox] Found ${achievements.titles.length} titles with potential achievements`);

    // Sort titles by last played/unlocked to ensure we check the most relevant ones
    if (achievements.titles.length > 0) {
      console.log('[Xbox] First title keys:', Object.keys(achievements.titles[0]));
    }

    const sortedTitles = achievements.titles.sort((a, b) => {
      const timeA = new Date(a.lastUnlock || a.lastPlayed || 0).getTime();
      const timeB = new Date(b.lastUnlock || b.lastPlayed || 0).getTime();
      return timeB - timeA;
    });

    const newAchievements = [];

    for (const title of sortedTitles.slice(0, 5)) { // Top 5 games
      try {
        console.log(`[Xbox] Processing title: ${title.name || title.titleName || 'Unknown'} (ID: ${title.titleId})`);

        // The player achievements endpoint only returns summary stats
        // We need to fetch individual achievements for this specific title
        console.log(`[Xbox] Fetching individual achievements for title ${title.titleId}...`);
        const titleAchievements = await getTitleAchievements(title.titleId, xuid);

        console.log(`[Xbox] Title achievements response structure:`, Object.keys(titleAchievements));

        if (!titleAchievements?.achievements || !Array.isArray(titleAchievements.achievements)) {
          console.log(`[Xbox] No achievements array found for title ${title.name}`);
          continue;
        }

        console.log(`[Xbox] Found ${titleAchievements.achievements.length} total achievements for ${title.name}`);

        // Filter to only unlocked achievements
        const unlockedAchievements = titleAchievements.achievements.filter(a => {
          // Check various fields that might indicate unlock status
          return a.progressState === 'Achieved' ||
            a.progression?.achieved === true ||
            a.achieved === true ||
            a.timeUnlocked;
        });

        console.log(`[Xbox] Found ${unlockedAchievements.length} unlocked achievements`);

        if (unlockedAchievements.length === 0) {
          console.log(`[Xbox] No unlocked achievements for ${title.name}, skipping`);
          continue;
        }

        // Log first achievement structure for debugging
        if (unlockedAchievements[0]) {
          console.log(`[Xbox] Sample unlocked achievement structure:`, Object.keys(unlockedAchievements[0]));
        }

        const processedAchievements = unlockedAchievements.map(a => {
          // Try multiple field names for achievement name
          const achievementName = a.name || a.achievementName || a.title || a.displayName || 'Unknown Achievement';

          // Try multiple field names for description
          const achievementDesc = a.description || a.achievementDescription || a.unlockedDescription || a.lockedDescription || '';

          // Try multiple field names for unlock time
          const unlockTime = a.timeUnlocked || a.unlockTime || a.progression?.timeUnlocked;

          // Try multiple field names for gamerscore
          const gamerscore = a.rewards?.[0]?.value || a.gamerscore || a.rewardsValue || a.value || 0;

          // Try multiple field names for icon
          const icon = a.mediaAssets?.[0]?.url || a.imageUrl || a.icon || a.titleAssociations?.[0]?.imageUrl || null;

          if (achievementName === 'Unknown Achievement') {
            console.log(`[Xbox] Could not find name for achievement, available fields:`, Object.keys(a));
          }

          return {
            id: `${title.titleId}_${a.id || a.achievementId || a.name}`,
            name: achievementName,
            description: achievementDesc,
            unlockTime: (() => {
              if (!unlockTime) return null;
              const date = new Date(unlockTime);
              // Filter out dates before 2005 (Xbox 360 launch)
              // This fixes the "23 years ago" issue where default dates (e.g. 2002) are returned
              if (date.getFullYear() < 2005) {
                console.log(`[Xbox] Ignored invalid unlock date: ${unlockTime} (${date.toISOString()}) for ${achievementName}`);
                return null;
              }
              return date.getTime() / 1000;
            })(),
            gameName: title.name || title.titleName || 'Unknown Game',
            gameId: title.titleId || title.id,
            gamerscore: gamerscore,
            icon: icon
          };
        });

        console.log(`[Xbox] Processed ${processedAchievements.length} achievements for ${title.name || title.titleName}`);
        newAchievements.push(...processedAchievements);
      } catch (err) {
        console.error(`[Xbox] Error processing title ${title.name}:`, err.message);
      }
    }

    console.log(`[Xbox] Total achievements found: ${newAchievements.length}`);
    return newAchievements;
  } catch (error) {
    console.error('[Xbox] Error fetching Xbox achievements:', error.message);
    console.error('[Xbox] Full error:', error);
    return [];
  }
}

/**
 * Check for new achievements across all platforms for all users
 * @returns {Object} New achievements organized by user and platform
 */
export async function checkNewAchievements() {
  console.log('Checking for new achievements...');

  const achievementData = readAchievementData();
  const users = getAllUsers();
  const newAchievements = {};

  for (const user of users) {
    const userId = user.discordId;

    // Initialize user data if not exists
    if (!achievementData.users[userId]) {
      achievementData.users[userId] = {
        steam: [],
        psn: [],
        xbox: []
      };
    }

    const userNewAchievements = {
      steam: [],
      psn: [],
      xbox: []
    };

    // Check Steam
    if (user.steam) {
      try {
        console.log(`Checking Steam for user ${userId}...`);
        const currentAchievements = await getSteamAchievements(user.steam);
        const previousAchievementIds = achievementData.users[userId].steam.map(a => a.id);

        userNewAchievements.steam = currentAchievements.filter(a =>
          !previousAchievementIds.includes(a.id)
        );

        // Update stored achievements
        achievementData.users[userId].steam = currentAchievements;
      } catch (err) {
        console.error(`Error checking Steam for ${userId}:`, err.message);
      }
    }

    // Check PSN
    if (user.psn) {
      try {
        console.log(`Checking PSN for user ${userId}...`);
        const currentTrophies = await getPSNTrophies(user.psn);

        // Handle migration from old object format to new array format
        let previousTrophyIds = [];
        if (Array.isArray(achievementData.users[userId].psn)) {
          previousTrophyIds = achievementData.users[userId].psn.map(t => t.id);
        } else {
          console.log(`Migrating PSN data for user ${userId} to new format...`);
          // If it was the old object format, we treat all current trophies as "seen" 
          // to avoid spamming old trophies, OR we could treat them as new.
          // Better to treat as seen so we don't spam. 
          // But since we can't know WHICH ones they had, we might just have to accept 
          // that the first run will populate the list without notifying, 
          // or we just notify for everything found in the last X hours?
          // Let's just populate the list for the first run and NOT notify to be safe,
          // or maybe just notify. 
          // Implementation decision: If migrating, don't notify.
          previousTrophyIds = currentTrophies.map(t => t.id);
        }

        userNewAchievements.psn = currentTrophies.filter(t =>
          !previousTrophyIds.includes(t.id)
        );

        // Update stored trophies
        achievementData.users[userId].psn = currentTrophies;
      } catch (err) {
        console.error(`Error checking PSN for ${userId}:`, err.message);
      }
    }

    // Check Xbox
    if (user.xbox) {
      try {
        console.log(`Checking Xbox for user ${userId}...`);
        const currentAchievements = await getXboxAchievementsData(user.xbox);
        const previousAchievementIds = achievementData.users[userId].xbox.map(a => a.id);

        userNewAchievements.xbox = currentAchievements.filter(a =>
          !previousAchievementIds.includes(a.id)
        );

        // Update stored achievements
        achievementData.users[userId].xbox = currentAchievements;
      } catch (err) {
        console.error(`Error checking Xbox for ${userId}:`, err.message);
      }
    }

    // Only add to results if user has new achievements
    if (userNewAchievements.steam.length > 0 ||
      userNewAchievements.psn.length > 0 ||
      userNewAchievements.xbox.length > 0) {
      newAchievements[userId] = userNewAchievements;
    }
  }

  // Update last sync time
  achievementData.lastSync = new Date().toISOString();
  writeAchievementData(achievementData);

  console.log(`Achievement check complete. Found new achievements for ${Object.keys(newAchievements).length} user(s).`);

  return newAchievements;
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime() {
  const data = readAchievementData();
  return data.lastSync;
}

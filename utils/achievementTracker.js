import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from './userData.js';
import { getSteamProfile, getPlayerAchievements, getAchievementSchema, getSteamGames } from './steamAPI.js';
import { getPSNProfile, getPSNUserTitles, getPSNTitleTrophies } from './psnAPI.js';
import { getXboxProfile, searchGamertag, getXboxAchievements } from './xboxAPI.js';

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
    const games = await getSteamGames(steamId);
    if (!games.games || games.games.length === 0) return [];

    const newAchievements = [];

    // Check top 5 most played games for new achievements
    const topGames = games.games
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 5);

    for (const game of topGames) {
      try {
        const achievements = await getPlayerAchievements(steamId, game.appid);
        const schema = await getAchievementSchema(game.appid);

        if (!achievements?.achievements || !schema?.availableGameStats?.achievements) continue;

        const unlockedAchievements = achievements.achievements
          .filter(a => a.achieved === 1)
          .map(a => {
            const details = schema.availableGameStats.achievements.find(s => s.name === a.apiname);
            return {
              id: `${game.appid}_${a.apiname}`,
              name: details?.displayName || a.apiname,
              description: details?.description || '',
              unlockTime: a.unlocktime,
              gameName: game.name,
              gameId: game.appid,
              icon: details?.icon || null
            };
          });

        newAchievements.push(...unlockedAchievements);
      } catch (err) {
        console.log(`Could not fetch achievements for game ${game.appid}:`, err.message);
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('Error fetching Steam achievements:', error.message);
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

        const trophiesResponse = await getPSNTitleTrophies(accountId, title.npCommunicationId);
        if (!trophiesResponse?.trophies) continue;

        const earnedTrophies = trophiesResponse.trophies
          .filter(t => t.earned)
          .map((t, index) => {
            if (index === 0) console.log('DEBUG TROPHY:', JSON.stringify(t, null, 2));
            return {
              id: `${title.npCommunicationId}_${t.trophyId}`,
              name: t.trophyName || 'Unknown Trophy',
              description: t.trophyDetail || '',
              unlockTime: t.earnedDateTime ? new Date(t.earnedDateTime).getTime() / 1000 : null,
              gameName: title.trophyTitleName || 'Unknown Game',
              gameId: title.npCommunicationId,
              type: t.trophyType,
              rarity: t.trophyEarnedRate,
              icon: t.trophyIconUrl || null
            }));

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
    const searchResult = await searchGamertag(gamertag);
    const xuid = searchResult.xuid;

    const achievements = await getXboxAchievements(xuid);

    // Parse achievement data if available
    if (!achievements?.titles || achievements.titles.length === 0) {
      console.log('No Xbox titles/achievements found in response');
      return [];
    }

    const newAchievements = [];

    for (const title of achievements.titles.slice(0, 5)) { // Top 5 games
      // Handle different response structures
      let achievementList = [];

      if (title.achievement?.currentAchievements) {
        achievementList = title.achievement.currentAchievements;
      } else if (title.achievements) {
        achievementList = title.achievements;
      } else if (Array.isArray(title.achievement)) {
        achievementList = title.achievement;
      }

      // Only process if we have an array
      if (Array.isArray(achievementList) && achievementList.length > 0) {
        const titleAchievements = achievementList.map(a => ({
          id: `${title.titleId}_${a.id || a.achievementId || a.name}`,
          name: a.name || a.achievementName || 'Unknown Achievement',
          description: a.description || a.achievementDescription || '',
          unlockTime: a.timeUnlocked ? new Date(a.timeUnlocked).getTime() / 1000 : null,
          gameName: title.name || title.titleName || 'Unknown Game',
          gameId: title.titleId || title.id,
          gamerscore: a.rewards?.[0]?.value || a.gamerscore || 0,
          icon: a.mediaAssets?.[0]?.url || a.imageUrl || null
        }));

        newAchievements.push(...titleAchievements);
      }
    }

    console.log(`Found ${newAchievements.length} Xbox achievements for ${gamertag}`);
    return newAchievements;
  } catch (error) {
    console.error('Error fetching Xbox achievements:', error.message);
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

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from './userData.js';
import { getSteamProfile, getPlayerAchievements, getAchievementSchema, getSteamGames } from './steamAPI.js';
import { getPSNProfile } from './psnAPI.js';
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
async function getPSNTrophies(psnId) {
  try {
    const profile = await getPSNProfile(psnId);
    
    // For now, we'll track trophy counts
    // To get individual trophies, you'd need to call getUserTitles and getTrophiesEarnedForTitle
    // which would require more API calls per user
    
    return {
      platinum: profile.earnedTrophies.platinum || 0,
      gold: profile.earnedTrophies.gold || 0,
      silver: profile.earnedTrophies.silver || 0,
      bronze: profile.earnedTrophies.bronze || 0,
      total: (profile.earnedTrophies.platinum || 0) + 
             (profile.earnedTrophies.gold || 0) + 
             (profile.earnedTrophies.silver || 0) + 
             (profile.earnedTrophies.bronze || 0)
    };
  } catch (error) {
    console.error('Error fetching PSN trophies:', error.message);
    return null;
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
    if (!achievements?.titles) return [];
    
    const newAchievements = [];
    
    for (const title of achievements.titles.slice(0, 5)) { // Top 5 games
      if (title.achievement?.currentAchievements) {
        newAchievements.push(...title.achievement.currentAchievements.map(a => ({
          id: `${title.titleId}_${a.id}`,
          name: a.name,
          description: a.description,
          unlockTime: a.timeUnlocked ? new Date(a.timeUnlocked).getTime() / 1000 : null,
          gameName: title.name,
          gameId: title.titleId,
          gamerscore: a.rewards?.[0]?.value || 0,
          icon: a.mediaAssets?.[0]?.url || null
        })));
      }
    }
    
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
  console.log('🔍 Checking for new achievements...');
  
  const achievementData = readAchievementData();
  const users = getAllUsers();
  const newAchievements = {};

  for (const user of users) {
    const userId = user.discordId;
    
    // Initialize user data if not exists
    if (!achievementData.users[userId]) {
      achievementData.users[userId] = {
        steam: [],
        psn: { platinum: 0, gold: 0, silver: 0, bronze: 0, total: 0 },
        xbox: []
      };
    }

    const userNewAchievements = {
      steam: [],
      psn: null,
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
        const previousTrophies = achievementData.users[userId].psn;

        if (currentTrophies && previousTrophies) {
          const diff = {
            platinum: currentTrophies.platinum - previousTrophies.platinum,
            gold: currentTrophies.gold - previousTrophies.gold,
            silver: currentTrophies.silver - previousTrophies.silver,
            bronze: currentTrophies.bronze - previousTrophies.bronze,
            total: currentTrophies.total - previousTrophies.total
          };

          if (diff.total > 0) {
            userNewAchievements.psn = diff;
          }
        }

        // Update stored trophies
        if (currentTrophies) {
          achievementData.users[userId].psn = currentTrophies;
        }
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
        userNewAchievements.psn || 
        userNewAchievements.xbox.length > 0) {
      newAchievements[userId] = userNewAchievements;
    }
  }

  // Update last sync time
  achievementData.lastSync = new Date().toISOString();
  writeAchievementData(achievementData);

  console.log(`✅ Achievement check complete. Found new achievements for ${Object.keys(newAchievements).length} user(s).`);
  
  return newAchievements;
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime() {
  const data = readAchievementData();
  return data.lastSync;
}

import fetch from 'node-fetch';
import config from '../config.js';

const OPENXBL_API_BASE = 'https://xbl.io/api/v2';

/**
 * Make authenticated request to OpenXBL API
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>} API response data
 */
async function openXBLRequest(endpoint) {
  const response = await fetch(`${OPENXBL_API_BASE}${endpoint}`, {
    headers: {
      'X-Authorization': config.xbox.apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`OpenXBL API error (${response.status}) for ${endpoint}:`, error);
    throw new Error(`OpenXBL API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Parse settings array into an object
 * @param {Array} settings - Settings array from API
 * @returns {Object} Parsed settings object
 */
function parseSettings(settings) {
  const parsed = {};
  if (!settings || !Array.isArray(settings)) return parsed;

  settings.forEach(setting => {
    parsed[setting.id] = setting.value;
  });

  return parsed;
}

/**
 * Search for Xbox user by gamertag
 * @param {string} gamertag - Xbox Gamertag
 * @returns {Promise<Object>} Search results with XUID
 */
export async function searchGamertag(gamertag) {
  console.log(`Searching for Xbox gamertag: ${gamertag}`);
  const data = await openXBLRequest(`/search/${encodeURIComponent(gamertag)}`);

  if (!data.people || data.people.length === 0) {
    throw new Error('Gamertag not found');
  }

  console.log(`Found XUID: ${data.people[0].xuid} for gamertag: ${gamertag}`);
  return data.people[0];
}

/**
 * Get Xbox account information
 * @param {string} xuid - Xbox User ID (XUID)
 * @returns {Promise<Object>} Account information
 */
export async function getXboxAccount(xuid) {
  console.log(`Fetching Xbox account for XUID: ${xuid}`);
  const data = await openXBLRequest(`/account/${xuid}`);
  return data;
}

/**
 * Get Xbox profile by gamertag
 * @param {string} gamertag - Xbox Gamertag
 * @returns {Promise<Object>} Profile data including gamerscore, account info
 */
export async function getXboxProfile(gamertag) {
  try {
    // First, search for the gamertag to get XUID
    const searchResult = await searchGamertag(gamertag);
    const xuid = searchResult.xuid;

    // Then get full account details
    const accountData = await getXboxAccount(xuid);

    // Parse the settings array
    const settings = parseSettings(accountData.profileUsers?.[0]?.settings);

    console.log('Parsed Xbox settings:', settings);

    return {
      xuid: xuid,
      gamertag: settings.Gamertag || gamertag,
      gamerscore: parseInt(settings.Gamerscore) || 0,
      accountTier: settings.AccountTier || 'Unknown',
      xboxOneRep: settings.XboxOneRep || 'Unknown',
      profilePicture: settings.GameDisplayPicRaw || null,
      bio: settings.Bio || null,
      location: settings.Location || null,
      realName: settings.RealName || null
    };
  } catch (error) {
    console.error('Error in getXboxProfile:', error);
    throw new Error(`Failed to get Xbox profile: ${error.message}`);
  }
}

/**
 * Get Xbox achievements for a user
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Achievement data
 */
export async function getXboxAchievements(xuid) {
  try {
    // Try the primary achievements endpoint
    const data = await openXBLRequest(`/achievements/player/${xuid}`);
    return data;
  } catch (error) {
    console.log(`Primary achievements endpoint failed: ${error.message}`);

    // Fallback 1: Try title-based achievements (requires title ID)
    try {
      const data = await openXBLRequest(`/achievements/x360/${xuid}`);
      return data;
    } catch (fallbackError) {
      console.log(`Fallback achievements endpoint failed: ${fallbackError.message}`);

      // Fallback 2: Return empty structure to prevent crashes
      // OpenXBL free tier may not support achievement endpoints
      console.log('Xbox achievement tracking unavailable - API tier limitation or endpoint changed');
      return { titles: [] };
    }
  }
}

/**
 * Get user's Xbox presence (current activity)
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Presence data
 */
export async function getXboxPresence(xuid) {
  const data = await openXBLRequest(`/presence/${xuid}`);
  return data;
}

/**
 * Get user's friends list
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Friends list
 */
export async function getXboxFriends(xuid) {
  const data = await openXBLRequest(`/friends/${xuid}`);
  return data;
}

/**
 * Get user's recent activity/games
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Recent activity data
 */
export async function getXboxActivity(xuid) {
  const data = await openXBLRequest(`/activity/${xuid}`);
  return data;
}

/**
 * Get recent player achievements (alternative endpoint)
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Recent achievements
 */
export async function getRecentAchievements(xuid) {
  try {
    const data = await openXBLRequest(`/achievements/recent/${xuid}`);
    return data;
  } catch (error) {
    console.log(`Recent achievements endpoint failed: ${error.message}`);
    return { items: [] };
  }
}

/**
 * Get achievements for a specific title
 * @param {string} titleId - Xbox Title ID
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Title achievements
 */
export async function getTitleAchievements(titleId, xuid) {
  try {
    if (!xuid || !titleId) {
      throw new Error(`Invalid parameters: xuid=${xuid}, titleId=${titleId}`);
    }
    // Correct endpoint: /achievements/player/{xuid}/title/{titleId}
    const data = await openXBLRequest(`/achievements/player/${xuid}/title/${titleId}`);
    return data;
  } catch (error) {
    console.log(`Title achievements endpoint failed for ${titleId}: ${error.message}`);
    return { achievements: [] };
  }
}

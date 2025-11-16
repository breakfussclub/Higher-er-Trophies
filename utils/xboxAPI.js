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
    throw new Error(`OpenXBL API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Search for Xbox user by gamertag
 * @param {string} gamertag - Xbox Gamertag
 * @returns {Promise<Object>} Search results with XUID
 */
export async function searchGamertag(gamertag) {
  const data = await openXBLRequest(`/search/${encodeURIComponent(gamertag)}`);

  if (!data.people || data.people.length === 0) {
    throw new Error('Gamertag not found');
  }

  return data.people[0]; // Return first match
}

/**
 * Get Xbox account information
 * @param {string} xuid - Xbox User ID (XUID)
 * @returns {Promise<Object>} Account information
 */
export async function getXboxAccount(xuid) {
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

    return {
      xuid: xuid,
      gamertag: accountData.gamertag || gamertag,
      gamerscore: accountData.gamerScore || 0,
      accountTier: accountData.accountTier || 'Unknown',
      xboxOneRep: accountData.xboxOneRep || 'Unknown',
      profilePicture: accountData.displayPicRaw || null,
      bio: accountData.bio || null,
      location: accountData.location || null,
      realName: accountData.realName || null
    };
  } catch (error) {
    throw new Error(`Failed to get Xbox profile: ${error.message}`);
  }
}

/**
 * Get Xbox achievements for a user
 * @param {string} xuid - Xbox User ID
 * @returns {Promise<Object>} Achievement data
 */
export async function getXboxAchievements(xuid) {
  const data = await openXBLRequest(`/achievements/${xuid}`);
  return data;
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

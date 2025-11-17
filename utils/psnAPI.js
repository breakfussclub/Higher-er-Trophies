import fetch from 'node-fetch';

const PSN_API_BASE = 'https://psn-api.achievements.app';

/**
 * Get PSN user profile by Online ID
 * @param {string} onlineId - PSN Online ID
 * @returns {Promise} User profile data
 */
export async function getPSNProfile(onlineId) {
  const url = `${PSN_API_BASE}/v1/users/${encodeURIComponent(onlineId)}/profile`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`PSN user not found: ${onlineId}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Get PSN trophy summary for a user
 * @param {string} onlineId - PSN Online ID
 * @returns {Promise} Trophy summary data
 */
export async function getPSNTrophySummary(onlineId) {
  const url = `${PSN_API_BASE}/v1/users/${encodeURIComponent(onlineId)}/trophy-summary`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Could not fetch trophy data for: ${onlineId}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Get PSN recently played games
 * @param {string} onlineId - PSN Online ID
 * @returns {Promise} Recently played games list
 */
export async function getPSNRecentGames(onlineId) {
  const url = `${PSN_API_BASE}/v1/users/${encodeURIComponent(onlineId)}/titles`;
  const response = await fetch(url);
  
  if (!response.ok) {
    return [];
  }
  
  const data = await response.json();
  return data.trophyTitles || [];
}

/**
 * Get user's recent trophies
 * @param {string} onlineId - PSN Online ID
 * @returns {Promise} Recent trophies earned
 */
export async function getPSNRecentTrophies(onlineId) {
  const url = `${PSN_API_BASE}/v1/users/${encodeURIComponent(onlineId)}/recent-trophies`;
  const response = await fetch(url);
  
  if (!response.ok) {
    return [];
  }
  
  const data = await response.json();
  return data.trophies || [];
}

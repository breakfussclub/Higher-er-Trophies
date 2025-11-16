import fetch from 'node-fetch';
import config from '../config.js';

const STEAM_API_BASE = 'https://api.steampowered.com';

/**
 * Get Steam user profile summary
 * @param {string} steamId - 64-bit Steam ID
 * @returns {Promise<Object>} User profile data
 */
export async function getSteamProfile(steamId) {
  const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${config.steam.apiKey}&steamids=${steamId}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.response?.players?.length) {
    throw new Error('Steam user not found');
  }

  return data.response.players[0];
}

/**
 * Get owned games for a Steam user
 * @param {string} steamId - 64-bit Steam ID
 * @returns {Promise<Object>} Owned games data
 */
export async function getSteamGames(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${config.steam.apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;

  const response = await fetch(url);
  const data = await response.json();

  return data.response;
}

/**
 * Get recently played games
 * @param {string} steamId - 64-bit Steam ID
 * @returns {Promise<Array>} Recently played games
 */
export async function getRecentlyPlayedGames(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${config.steam.apiKey}&steamid=${steamId}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.response?.games || [];
}

/**
 * Get player achievements for a specific game
 * @param {string} steamId - 64-bit Steam ID
 * @param {number} appId - Steam App ID
 * @returns {Promise<Object>} Achievement data
 */
export async function getSteamAchievements(steamId, appId) {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${config.steam.apiKey}&steamid=${steamId}&appid=${appId}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.playerstats;
}

/**
 * Resolve vanity URL to Steam ID
 * @param {string} vanityUrl - Steam vanity URL (custom username)
 * @returns {Promise<string>} 64-bit Steam ID
 */
export async function resolveVanityUrl(vanityUrl) {
  const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${config.steam.apiKey}&vanityurl=${vanityUrl}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.response.success !== 1) {
    throw new Error('Could not resolve Steam vanity URL');
  }

  return data.response.steamid;
}

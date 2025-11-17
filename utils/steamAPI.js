import fetch from 'node-fetch';
import config from '../config.js';

const STEAM_API_BASE = 'https://api.steampowered.com';

/**
 * Resolves a Steam vanity URL to SteamID64
 * @param {string} vanityName - The vanity name part of the URL
 * @returns {Promise<string>} - The 64-bit SteamID
 */
export async function resolveVanityUrl(vanityName) {
  const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${config.steam.apiKey}&vanityurl=${vanityName}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.response.success !== 1) {
    throw new Error('Vanity URL could not be resolved');
  }
  return data.response.steamid;
}

/**
 * Get Steam user profile summary
 * @param {string} steamId - 64-bit Steam ID
 * @returns {Promise} User profile data
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
 * @returns {Promise} Owned games data
 */
export async function getSteamGames(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${config.steam.apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
  const response = await fetch(url);
  const data = await response.json();
  return data.response;
}

/**
 * Get Steam user level
 * @param {string} steamId - 64-bit Steam ID
 * @returns {Promise<Object>} Level data including player_level number
 */
export async function getSteamLevel(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetSteamLevel/v1/?key=${config.steam.apiKey}&steamid=${steamId}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.response;
}

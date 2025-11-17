import fetch from 'node-fetch';
import config from '../config.js';

const STEAM_API_BASE = 'https://api.steampowered.com';

export async function resolveVanityUrl(vanityName) {
  const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${config.steam.apiKey}&vanityurl=${vanityName}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.response.success !== 1) {
    throw new Error('Vanity URL could not be resolved');
  }
  return data.response.steamid;
}

export async function getSteamProfile(steamId) {
  const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${config.steam.apiKey}&steamids=${steamId}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.response?.players?.length) {
    throw new Error('Steam user not found');
  }
  return data.response.players[0];
}

export async function getSteamGames(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${config.steam.apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
  const response = await fetch(url);
  const data = await response.json();
  return data.response;
}

export async function getSteamLevel(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetSteamLevel/v1/?key=${config.steam.apiKey}&steamid=${steamId}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.response;
}

export async function getSteamBadges(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetBadges/v1/?key=${config.steam.apiKey}&steamid=${steamId}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.response;
}

export async function getRecentlyPlayedGames(steamId) {
  const url = `${STEAM_API_BASE}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${config.steam.apiKey}&steamid=${steamId}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.response;
}

export async function getPlayerAchievements(steamId, appId) {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appId}&key=${config.steam.apiKey}&steamid=${steamId}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.playerstats;
}

// NEW: Get achievement schema with names/descriptions for a game
export async function getAchievementSchema(appId) {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${config.steam.apiKey}&appid=${appId}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.game;
}

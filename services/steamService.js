import fetch from 'node-fetch';
import config from '../config.js';
import logger from '../utils/logger.js';

const STEAM_API_BASE = 'https://api.steampowered.com';

export async function resolveVanityUrl(vanityName) {
    try {
        const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${config.steam.apiKey}&vanityurl=${vanityName}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.response.success !== 1) {
            throw new Error('Vanity URL could not be resolved');
        }
        return data.response.steamid;
    } catch (error) {
        logger.error(`[Steam] Error resolving vanity URL ${vanityName}: ${error.message}`);
        throw error;
    }
}

export async function getSteamProfile(steamId) {
    try {
        const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${config.steam.apiKey}&steamids=${steamId}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.response?.players?.length) {
            throw new Error('Steam user not found');
        }
        return data.response.players[0];
    } catch (error) {
        logger.error(`[Steam] Error fetching profile for ${steamId}: ${error.message}`);
        throw error;
    }
}

export async function getSteamGames(steamId) {
    try {
        const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${config.steam.apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
        const response = await fetch(url);
        const data = await response.json();
        return data.response;
    } catch (error) {
        logger.error(`[Steam] Error fetching games for ${steamId}: ${error.message}`);
        return { games: [] };
    }
}

export async function getPlayerAchievements(steamId, appId) {
    try {
        const url = `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appId}&key=${config.steam.apiKey}&steamid=${steamId}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || !data.playerstats?.success) {
            // This is common for games without achievements or private profiles, so warn instead of error
            // logger.warn(`[Steam] Game ${appId} does not support achievements or stats are private`);
            return null;
        }

        return data.playerstats;
    } catch (error) {
        logger.error(`[Steam] Error fetching achievements for ${steamId} in app ${appId}: ${error.message}`);
        return null;
    }
}

export async function getAchievementSchema(appId) {
    try {
        const url = `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${config.steam.apiKey}&appid=${appId}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || !data.game) {
            return null;
        }

        return data.game;
    } catch (error) {
        logger.error(`[Steam] Error fetching schema for app ${appId}: ${error.message}`);
        return null;
    }
}

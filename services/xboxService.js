import fetch from 'node-fetch';
import config from '../config.js';
import logger from '../utils/logger.js';

const OPENXBL_API_BASE = 'https://xbl.io/api/v2';

async function openXBLRequest(endpoint) {
    const response = await fetch(`${OPENXBL_API_BASE}${endpoint}`, {
        headers: {
            'X-Authorization': config.xbox.apiKey,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        logger.error(`[Xbox] API error (${response.status}) for ${endpoint}: ${error}`);
        throw new Error(`OpenXBL API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data;
}

function parseSettings(settings) {
    const parsed = {};
    if (!settings || !Array.isArray(settings)) return parsed;

    settings.forEach(setting => {
        parsed[setting.id] = setting.value;
    });

    return parsed;
}

export async function searchGamertag(gamertag) {
    logger.info(`[Xbox] Searching for gamertag: ${gamertag}`);
    const data = await openXBLRequest(`/search/${encodeURIComponent(gamertag)}`);

    if (!data.people || data.people.length === 0) {
        throw new Error('Gamertag not found');
    }

    logger.info(`[Xbox] Found XUID: ${data.people[0].xuid} for gamertag: ${gamertag}`);
    return data.people[0];
}

export async function getXboxAccount(xuid) {
    logger.info(`[Xbox] Fetching account for XUID: ${xuid}`);
    const data = await openXBLRequest(`/account/${xuid}`);
    return data;
}

export async function getXboxProfile(gamertag) {
    try {
        const searchResult = await searchGamertag(gamertag);
        const xuid = searchResult.xuid;

        const accountData = await getXboxAccount(xuid);
        const settings = parseSettings(accountData.profileUsers?.[0]?.settings);

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
        logger.error(`[Xbox] Error getting profile for ${gamertag}: ${error.message}`);
        throw new Error(`Failed to get Xbox profile: ${error.message}`);
    }
}

export async function getXboxAchievements(xuid) {
    try {
        const data = await openXBLRequest(`/achievements/player/${xuid}`);
        return data;
    } catch (error) {
        logger.warn(`[Xbox] Primary achievements endpoint failed: ${error.message}`);
        return { titles: [] };
    }
}

export async function getTitleAchievements(titleId, xuid) {
    try {
        if (!xuid || !titleId) {
            throw new Error(`Invalid parameters: xuid=${xuid}, titleId=${titleId}`);
        }
        const data = await openXBLRequest(`/achievements/player/${xuid}/title/${titleId}`);
        return data;
    } catch (error) {
        logger.warn(`[Xbox] Title achievements endpoint failed for ${titleId}: ${error.message}`);
        return { achievements: [] };
    }
}

export async function getRecentAchievements(xuid) {
    try {
        // 1. Get titles
        const titlesData = await getXboxAchievements(xuid);
        if (!titlesData || !titlesData.titles) return [];

        // 2. Sort by last unlock and take top 3
        const recentTitles = titlesData.titles
            .sort((a, b) => new Date(b.lastUnlock) - new Date(a.lastUnlock))
            .slice(0, 3);

        let allAchievements = [];

        // 3. Fetch achievements for these titles
        for (const title of recentTitles) {
            const achData = await getTitleAchievements(title.titleId, xuid);
            if (achData && achData.achievements) {
                // Add title name to each achievement for display
                const achievementsWithTitle = achData.achievements.map(a => ({
                    ...a,
                    titleAssociations: [{ name: title.name }]
                }));
                allAchievements.push(...achievementsWithTitle);
            }
        }

        // 4. Sort all by timeUnlocked
        return allAchievements
            .filter(a => a.progressState === 'Achieved' || a.achieved === true || a.progression?.achieved === true)
            .map(a => ({
                ...a,
                name: a.name || a.achievementName || 'Unknown Achievement',
                description: a.description || a.lockedDescription || 'No description'
            }))
            .sort((a, b) => {
                const timeA = new Date(a.progression?.timeUnlocked || a.timeUnlocked || 0);
                const timeB = new Date(b.progression?.timeUnlocked || b.timeUnlocked || 0);
                return timeB - timeA;
            });
    } catch (error) {
        logger.error(`[Xbox] Error fetching recent achievements: ${error.message}`);
        return [];
    }
}

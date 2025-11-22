import {
    exchangeNpssoForAccessCode,
    exchangeAccessCodeForAuthTokens,
    exchangeRefreshTokenForAuthTokens,
    getProfileFromUserName,
    getUserTrophyProfileSummary,
    getProfileFromAccountId,
    getUserTitles,
    getUserTrophiesEarnedForTitle,
    getTitleTrophies
} from 'psn-api';
import logger from '../utils/logger.js';

let authCache = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
};

const NPSSO = process.env.PSN_NPSSO;

async function getAccessToken() {
    if (authCache.accessToken && authCache.expiresAt && Date.now() < authCache.expiresAt) {
        return authCache.accessToken;
    }

    if (authCache.refreshToken) {
        try {
            logger.info('[PSN] Refreshing access token...');
            const authorization = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken);
            authCache.accessToken = authorization.accessToken;
            authCache.refreshToken = authorization.refreshToken;
            authCache.expiresAt = Date.now() + (50 * 60 * 1000);
            logger.info('[PSN] Access token refreshed successfully');
            return authorization.accessToken;
        } catch (error) {
            logger.error(`[PSN] Failed to refresh token: ${error.message}`);
            authCache = { accessToken: null, refreshToken: null, expiresAt: null };
        }
    }

    try {
        logger.info('[PSN] Obtaining new access token from NPSSO...');
        const accessCode = await exchangeNpssoForAccessCode(NPSSO);
        const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
        authCache.accessToken = authorization.accessToken;
        authCache.refreshToken = authorization.refreshToken;
        authCache.expiresAt = Date.now() + (50 * 60 * 1000);
        logger.info('[PSN] Access token obtained successfully');
        return authorization.accessToken;
    } catch (error) {
        logger.error(`[PSN] Failed to obtain access token: ${error.message}`);
        throw new Error('PSN authentication failed. Check your NPSSO token.');
    }
}

export async function getAuthorization() {
    const accessToken = await getAccessToken();
    return { accessToken };
}

export async function getPSNAccountId(onlineId) {
    try {
        if (onlineId.toLowerCase() === 'me') {
            return {
                accountId: 'me',
                onlineId: 'me',
                isAuthenticatedUser: true
            };
        }

        const authorization = await getAuthorization();

        logger.info(`[PSN] Looking up exact profile for Online ID: "${onlineId}"`);
        const response = await getProfileFromUserName(authorization, onlineId);

        const profile = response.profile || response;
        const accountId = profile.accountId;
        const returnedOnlineId = profile.onlineId;

        logger.info(`[PSN] Found exact match: "${returnedOnlineId}" (Account ID: ${accountId})`);

        return {
            accountId: accountId,
            onlineId: returnedOnlineId,
            isExactMatch: true
        };
    } catch (error) {
        logger.error(`[PSN] Error looking up "${onlineId}": ${error.message}`);

        if (error.message.includes('not found') || error.message.includes('404')) {
            throw new Error(`PSN user "${onlineId}" not found. Double-check the spelling of your Online ID.`);
        } else if (error.message.includes('permission') || error.message.includes('private')) {
            throw new Error(`PSN profile for "${onlineId}" is not accessible. Make sure the profile is public and trophies are visible to "Anyone".`);
        } else {
            throw new Error(`Could not fetch PSN user "${onlineId}": ${error.message}`);
        }
    }
}

export async function getFullProfile(accountId) {
    try {
        const authorization = await getAuthorization();
        const profile = await getProfileFromAccountId(authorization, accountId);
        return profile;
    } catch (error) {
        logger.error(`[PSN] Error fetching full profile for ${accountId}: ${error.message}`);
        throw error;
    }
}

export async function getPSNProfile(onlineIdOrAccountId) {
    try {
        const accessToken = await getAccessToken();

        let accountId;
        let onlineId = onlineIdOrAccountId;

        if (onlineIdOrAccountId.toLowerCase() === 'me') {
            accountId = 'me';
            onlineId = 'me';
        } else if (/^\d+$/.test(onlineIdOrAccountId)) {
            accountId = onlineIdOrAccountId;
        } else {
            const searchData = await getPSNAccountId(onlineIdOrAccountId);
            accountId = searchData.accountId;
            onlineId = searchData.onlineId;
        }

        const trophyData = await getUserTrophyProfileSummary(
            { accessToken },
            accountId
        );

        let avatarUrl = null;

        try {
            const fullProfile = await getFullProfile(accountId);
            console.log('Full Profile Response:', JSON.stringify(fullProfile, null, 2)); // DEBUG
            if (fullProfile?.profile?.avatars && fullProfile.profile.avatars.length > 0) {
                avatarUrl = fullProfile.profile.avatars[0].url;
            }
            if (fullProfile?.profile?.onlineId) {
                onlineId = fullProfile.profile.onlineId;
            }
        } catch (err) {
            console.error('Error fetching full PSN profile:', err.message); // DEBUG
            // Ignore profile fetch errors (privacy settings)
        }

        return {
            accountId: trophyData.accountId,
            onlineId: onlineId,
            avatarUrl: avatarUrl,
            trophyLevel: trophyData.trophyLevel,
            progress: trophyData.progress,
            tier: trophyData.tier,
            earnedTrophies: trophyData.earnedTrophies,
            _rawTrophyData: trophyData
        };
    } catch (error) {
        logger.error(`[PSN] Error fetching profile for ${onlineIdOrAccountId}: ${error.message}`);
        throw error;
    }
}

export async function getPSNUserTitles(accountId) {
    try {
        const authorization = await getAuthorization();
        const response = await getUserTitles(authorization, accountId);
        return response;
    } catch (error) {
        logger.error(`[PSN] Error fetching titles for ${accountId}: ${error.message}`);
        throw error;
    }
}

export async function getPSNTitleTrophies(accountId, npCommunicationId, trophyGroupId = 'default') {
    try {
        const authorization = await getAuthorization();
        const response = await getUserTrophiesEarnedForTitle(
            authorization,
            accountId,
            npCommunicationId,
            trophyGroupId,
            {
                includeMetadata: true
            }
        );
        return response;
    } catch (error) {
        logger.error(`[PSN] Error fetching trophies for title ${npCommunicationId}: ${error.message}`);
        return null;
    }
}

export async function getPSNGameTrophies(npCommunicationId, trophyGroupId = 'default') {
    try {
        const authorization = await getAuthorization();
        const response = await getTitleTrophies(
            authorization,
            npCommunicationId,
            trophyGroupId
        );
        return response;
    } catch (error) {
        logger.error(`[PSN] Error fetching game trophies for ${npCommunicationId}: ${error.message}`);
        return null;
    }
}

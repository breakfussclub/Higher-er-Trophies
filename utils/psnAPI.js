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

let authCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

const NPSSO = process.env.PSN_NPSSO;

async function getAccessToken() {
  if (authCache.accessToken && authCache.expiresAt && Date.now() < authCache.expiresAt) {
    console.log('Using cached PSN access token');
    return authCache.accessToken;
  }

  if (authCache.refreshToken) {
    try {
      console.log('Refreshing PSN access token...');
      const authorization = await exchangeRefreshTokenForAuthTokens(authCache.refreshToken);
      authCache.accessToken = authorization.accessToken;
      authCache.refreshToken = authorization.refreshToken;
      authCache.expiresAt = Date.now() + (50 * 60 * 1000);
      console.log('PSN access token refreshed successfully');
      return authorization.accessToken;
    } catch (error) {
      console.error('Failed to refresh token:', error.message);
      authCache = { accessToken: null, refreshToken: null, expiresAt: null };
    }
  }

  try {
    console.log('Obtaining new PSN access token from NPSSO...');
    const accessCode = await exchangeNpssoForAccessCode(NPSSO);
    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
    authCache.accessToken = authorization.accessToken;
    authCache.refreshToken = authorization.refreshToken;
    authCache.expiresAt = Date.now() + (50 * 60 * 1000);
    console.log('PSN access token obtained successfully');
    return authorization.accessToken;
  } catch (error) {
    console.error('Failed to obtain PSN access token:', error);
    throw new Error('PSN authentication failed. Check your NPSSO token.');
  }
}

export async function getAuthorization() {
  const accessToken = await getAccessToken();
  return { accessToken };
}

/**
 * Get account ID from Online ID (username) - EXACT MATCH
 * Uses getProfileFromUserName for exact lookups (not fuzzy search)
 * @param {string} onlineId - PSN Online ID (username)
 * @returns {Promise} Profile data with accountId and onlineId
 */
export async function getPSNAccountId(onlineId) {
  try {
    if (onlineId.toLowerCase() === 'me') {
      console.log('Special identifier "me" detected - using authenticated user');
      return {
        accountId: 'me',
        onlineId: 'me',
        isAuthenticatedUser: true
      };
    }

    const authorization = await getAuthorization();

    console.log(`[PSN] Looking up exact profile for Online ID: "${onlineId}"`);
    const response = await getProfileFromUserName(authorization, onlineId);

    // Extract from nested profile object
    const profile = response.profile || response;

    const accountId = profile.accountId;
    const returnedOnlineId = profile.onlineId;

    console.log(`[PSN] ✅ Found exact match: "${returnedOnlineId}" (Account ID: ${accountId})`);

    return {
      accountId: accountId,
      onlineId: returnedOnlineId,
      isExactMatch: true
    };
  } catch (error) {
    console.error(`[PSN] ❌ Error looking up "${onlineId}":`, error.message);

    // Better error messaging for common cases
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
    console.log('[PSN] Full profile fetched');
    return profile;
  } catch (error) {
    console.error('[PSN] Error fetching full PSN profile:', error.message);
    throw error;
  }
}

/**
 * Get PSN profile and trophy summary with full details
 * @param {string} onlineIdOrAccountId - "me", PSN Online ID, or numeric Account ID
 * @returns {Promise} Complete profile and trophy data
 */
export async function getPSNProfile(onlineIdOrAccountId) {
  try {
    const accessToken = await getAccessToken();

    let accountId;
    let onlineId = onlineIdOrAccountId;

    if (onlineIdOrAccountId.toLowerCase() === 'me') {
      console.log(`[PSN] Using special "me" identifier for authenticated user`);
      accountId = 'me';
      onlineId = 'me';
    } else if (/^\d+$/.test(onlineIdOrAccountId)) {
      console.log(`[PSN] Using numeric account ID: ${onlineIdOrAccountId}`);
      accountId = onlineIdOrAccountId;
    } else {
      console.log(`[PSN] Exact lookup for Online ID: "${onlineIdOrAccountId}"`);
      const searchData = await getPSNAccountId(onlineIdOrAccountId);
      accountId = searchData.accountId;
      onlineId = searchData.onlineId;
    }

    console.log(`[PSN] Fetching trophy data for account ID: ${accountId}`);

    const trophyData = await getUserTrophyProfileSummary(
      { accessToken },
      accountId
    );

    console.log('[PSN] Trophy data fetched successfully');

    let avatarUrl = null;

    try {
      const fullProfile = await getFullProfile(accountId);
      if (fullProfile?.profile?.avatars && fullProfile.profile.avatars.length > 0) {
        avatarUrl = fullProfile.profile.avatars[0].url;
        console.log('[PSN] Avatar URL found');
      }

      if (fullProfile?.profile?.onlineId) {
        onlineId = fullProfile.profile.onlineId;
      }
    } catch (err) {
      console.log('[PSN] Could not fetch full profile (may be private or restricted)');
      // Continue without avatar - not critical
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
    console.error('[PSN] Error fetching PSN profile:', error.message);
    throw error;
  }
}

export async function getPSNTrophySummary(onlineIdOrAccountId) {
  try {
    const profile = await getPSNProfile(onlineIdOrAccountId);
    return {
      trophySummary: {
        level: profile.trophyLevel,
        progress: profile.progress,
        tier: profile.tier,
        earnedTrophies: {
          bronze: profile.earnedTrophies.bronze,
          silver: profile.earnedTrophies.silver,
          gold: profile.earnedTrophies.gold,
          platinum: profile.earnedTrophies.platinum
        }
      }
    };
  } catch (error) {
    console.error('[PSN] Error fetching PSN trophy summary:', error.message);
    throw error;
  }
}

/**
 * Get user's game titles
 * @param {string} accountId - PSN Account ID
 * @returns {Promise} List of game titles
 */
export async function getPSNUserTitles(accountId) {
  try {
    const authorization = await getAuthorization();
    console.log(`[PSN] Fetching titles for account ID: ${accountId}`);
    const response = await getUserTitles(authorization, accountId);
    return response;
  } catch (error) {
    console.error('[PSN] Error fetching user titles:', error.message);
    throw error;
  }
}

/**
 * Get trophies earned for a specific title
 * @param {string} accountId - PSN Account ID
 * @param {string} npCommunicationId - Game's NP Communication ID
 * @param {string} trophyGroupId - Trophy Group ID (usually "default")
 * @returns {Promise} List of earned trophies
 */
export async function getPSNTitleTrophies(accountId, npCommunicationId, trophyGroupId = 'default') {
  try {
    const authorization = await getAuthorization();
    // console.log(`[PSN] Fetching trophies for title: ${npCommunicationId}`);
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
    // Some games might not have trophies or might error out, just log and return null
    console.error(`[PSN] Error fetching trophies for title ${npCommunicationId}:`, error.message);
    return null;
  }
}

/**
 * Get static trophy data for a title (names, descriptions, icons)
 * @param {string} npCommunicationId - Game's NP Communication ID
 * @param {string} trophyGroupId - Trophy Group ID (usually "default")
 * @returns {Promise} List of all trophies for the title
 */
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
    console.error(`[PSN] Error fetching game trophies for ${npCommunicationId}:`, error.message);
    return null;
  }
}

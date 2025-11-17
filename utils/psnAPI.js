import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTrophyProfileSummary,
  getProfileFromAccountId
} from 'psn-api';

// Store auth tokens in memory with expiration
let authCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

const NPSSO = process.env.PSN_NPSSO;

/**
 * Get valid access token, refreshing if necessary
 */
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
      console.error('Failed to refresh token, will obtain new one:', error.message);
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
    throw new Error('PSN authentication failed. Please check your NPSSO token.');
  }
}

/**
 * Get authorization object with access token
 * @returns {Promise} Authorization object { accessToken: string }
 */
export async function getAuthorization() {
  const accessToken = await getAccessToken();
  return { accessToken };
}

/**
 * Get account ID from Online ID (username) - EXACT MATCH
 * Uses getProfileFromUserName which does exact lookups, not fuzzy search!
 * @param {string} onlineId - PSN Online ID (username)
 * @returns {Promise} Profile data with accountId and onlineId
 */
export async function getPSNAccountId(onlineId) {
  try {
    // Special case: "me" refers to the authenticated user
    if (onlineId.toLowerCase() === 'me') {
      console.log('Special identifier "me" detected - using authenticated user');
      return {
        accountId: 'me',
        onlineId: 'me',
        isAuthenticatedUser: true
      };
    }
    
    const authorization = await getAuthorization();
    
    // KEY CHANGE: Use getProfileFromUserName for EXACT lookups
    // This should NOT do fuzzy matching like makeUniversalSearch does
    console.log(`Looking up exact profile for Online ID: "${onlineId}"`);
    const profile = await getProfileFromUserName(authorization, onlineId);
    
    console.log(`✅ Found exact match: "${profile.onlineId}" (Account ID: ${profile.accountId})`);
    
    return {
      accountId: profile.accountId,
      onlineId: profile.onlineId,
      isExactMatch: true
    };
  } catch (error) {
    console.error(`Error looking up PSN user "${onlineId}":`, error.message);
    throw new Error(`PSN user "${onlineId}" not found. Please verify the username is correct.`);
  }
}

/**
 * Get full PSN profile with avatar and online ID
 * @param {string} accountId - PSN Account ID (numeric) or "me" for authenticated user
 * @returns {Promise} Full profile data
 */
export async function getFullProfile(accountId) {
  try {
    const authorization = await getAuthorization();
    const profile = await getProfileFromAccountId(authorization, accountId);
    console.log('Full profile fetched');
    return profile;
  } catch (error) {
    console.error('Error fetching full PSN profile:', error);
    throw error;
  }
}

/**
 * Get PSN profile and trophy summary with full details
 * Accepts:
 * - "me" = Your own authenticated account
 * - Online ID (username) = Direct exact lookup (NOT fuzzy search!)
 * - Numeric account ID = Direct lookup
 * @param {string} onlineIdOrAccountId - "me", PSN Online ID, or numeric Account ID
 * @returns {Promise} Complete profile and trophy data
 */
export async function getPSNProfile(onlineIdOrAccountId) {
  try {
    const accessToken = await getAccessToken();

    let accountId;
    let onlineId = onlineIdOrAccountId;

    // Handle special "me" identifier for authenticated user
    if (onlineIdOrAccountId.toLowerCase() === 'me') {
      console.log(`Using special "me" identifier for authenticated user`);
      accountId = 'me';
      onlineId = 'me';
    } else if (/^\d+$/.test(onlineIdOrAccountId)) {
      // It's already a numeric account ID
      console.log(`Using numeric account ID: ${onlineIdOrAccountId}`);
      accountId = onlineIdOrAccountId;
    } else {
      // It's an online ID, use exact lookup via getPSNAccountId
      console.log(`\n=== EXACT LOOKUP FOR ONLINE ID: "${onlineIdOrAccountId}" ===`);
      const searchData = await getPSNAccountId(onlineIdOrAccountId);
      accountId = searchData.accountId;
      onlineId = searchData.onlineId;
    }

    console.log(`Fetching trophy data for account ID: ${accountId}`);

    // Get trophy profile summary
    const trophyData = await getUserTrophyProfileSummary(
      { accessToken },
      accountId
    );

    console.log('Trophy data fetched successfully');

    // Get full profile for avatar and online ID (optional)
    let avatarUrl = null;

    try {
      const fullProfile = await getFullProfile(accountId);
      if (fullProfile?.profile?.avatars && fullProfile.profile.avatars.length > 0) {
        avatarUrl = fullProfile.profile.avatars[0].url;
        console.log('Avatar URL found');
      }

      // Update online ID if we got it from full profile
      if (fullProfile?.profile?.onlineId) {
        onlineId = fullProfile.profile.onlineId;
      }
    } catch (err) {
      console.log('Could not fetch full profile (account may be private):', err.message);
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
    console.error('Error fetching PSN profile:', error);
    throw error;
  }
}

/**
 * Get PSN trophy summary (wrapper for backward compatibility)
 * @param {string} onlineIdOrAccountId - "me", PSN Online ID, or Account ID
 * @returns {Promise} Trophy summary
 */
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
    console.error('Error fetching PSN trophy summary:', error);
    throw error;
  }
}

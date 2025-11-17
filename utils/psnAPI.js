import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  makeUniversalSearch,
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
  // Check if we have a valid cached token
  if (authCache.accessToken && authCache.expiresAt && Date.now() < authCache.expiresAt) {
    console.log('Using cached PSN access token');
    return authCache.accessToken;
  }

  // Try to refresh using refresh token if we have one
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

  // Get fresh tokens from NPSSO
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
 * Search for a PSN user and get their account ID
 * NOTE: PSN's search API won't return your own account if you search for yourself
 * Use "me" for your own authenticated account instead
 * @param {string} onlineId - PSN Online ID (username)
 * @returns {Promise} Search result with accountId, avatar, and onlineId
 */
export async function getPSNAccountId(onlineId) {
  try {
    const accessToken = await getAccessToken();
    
    // Special case: "me" refers to the authenticated user
    if (onlineId.toLowerCase() === 'me') {
      console.log('Special identifier "me" detected - using authenticated user');
      return {
        accountId: 'me',
        avatarUrl: null,
        onlineId: 'me',
        isAuthenticatedUser: true
      };
    }
    
    const searchResults = await makeUniversalSearch(
      { accessToken },
      onlineId,
      'SocialAllAccounts'
    );

    if (!searchResults?.domainResponses?.[0]?.results?.length) {
      throw new Error(`PSN user "${onlineId}" not found`);
    }

    const results = searchResults.domainResponses[0].results;
    const user = results[0];

    console.log(`Search for "${onlineId}" returned "${user.socialMetadata.onlineId}"`);

    return {
      accountId: user.socialMetadata.accountId,
      avatarUrl: user.socialMetadata.avatarUrl || null,
      onlineId: user.socialMetadata.onlineId || onlineId,
      isAuthenticatedUser: false
    };
  } catch (error) {
    console.error('Error searching for PSN user:', error);
    throw error;
  }
}

/**
 * Get full PSN profile with avatar and online ID
 * @param {string} accountId - PSN Account ID (numeric), "me" for authenticated user
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
 * - Online ID (username) = Searches for that user
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
      accountId = onlineIdOrAccountId;
    } else {
      // It's an online ID, need to look up account ID via search
      console.log(`Searching for PSN user: "${onlineIdOrAccountId}"`);
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

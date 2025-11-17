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
      // Tokens typically expire in 1 hour, cache for 50 minutes to be safe
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
 * @returns {Promise<Object>} Authorization object { accessToken: string }
 */
export async function getAuthorization() {
  const accessToken = await getAccessToken();
  return { accessToken };
}

/**
 * Search for a PSN user and get their account ID
 * @param {string} onlineId - PSN Online ID (username)
 * @returns {Promise<Object>} Search result with accountId and avatar
 */
export async function getPSNAccountId(onlineId) {
  try {
    const accessToken = await getAccessToken();
    
    const searchResults = await makeUniversalSearch(
      { accessToken },
      onlineId,
      'SocialAllAccounts'
    );

    if (!searchResults?.domainResponses?.[0]?.results?.length) {
      throw new Error(`PSN user "${onlineId}" not found`);
    }

    const user = searchResults.domainResponses[0].results[0];
    
    // Return both account ID and avatar URL from search
    return {
      accountId: user.socialMetadata.accountId,
      avatarUrl: user.socialMetadata.avatarUrl || null,
      onlineId: user.socialMetadata.onlineId || onlineId
    };
  } catch (error) {
    console.error('Error searching for PSN user:', error);
    throw error;
  }
}

/**
 * Get full PSN profile with avatar and online ID
 * @param {string} accountId - PSN Account ID (numeric)
 * @returns {Promise<Object>} Full profile data
 */
export async function getFullProfile(accountId) {
  try {
    const authorization = await getAuthorization();
    const profile = await getProfileFromAccountId(authorization, accountId);
    console.log('Full profile data:', JSON.stringify(profile, null, 2));
    return profile;
  } catch (error) {
    console.error('Error fetching full PSN profile:', error);
    throw error;
  }
}

/**
 * Get PSN profile and trophy summary with full details
 * @param {string} onlineIdOrAccountId - PSN Online ID or numeric Account ID
 * @returns {Promise<Object>} Complete profile and trophy data
 */
export async function getPSNProfile(onlineIdOrAccountId) {
  try {
    const accessToken = await getAccessToken();
    
    // Determine if input is accountId (numeric) or onlineId (string)
    let accountId;
    let searchData = null;
    
    if (/^\d+$/.test(onlineIdOrAccountId)) {
      // It's already an account ID
      accountId = onlineIdOrAccountId;
    } else {
      // It's an online ID, need to look up account ID
      searchData = await getPSNAccountId(onlineIdOrAccountId);
      accountId = searchData.accountId;
    }

    console.log(`Fetching trophy data for account ID: ${accountId}`);

    // Get trophy profile summary
    const trophyData = await getUserTrophyProfileSummary(
      { accessToken },
      accountId
    );

    console.log('Raw trophy data from API:', JSON.stringify(trophyData, null, 2));

    // Get full profile for avatar and online ID
    let fullProfile = null;
    let avatarUrl = searchData?.avatarUrl || null;
    let onlineId = searchData?.onlineId || onlineIdOrAccountId;
    
    try {
      fullProfile = await getFullProfile(accountId);
      
      // Try multiple avatar sources
      if (fullProfile?.profile?.avatars && fullProfile.profile.avatars.length > 0) {
        avatarUrl = fullProfile.profile.avatars[0].url;
      }
      
      if (fullProfile?.profile?.onlineId) {
        onlineId = fullProfile.profile.onlineId;
      }
      
      console.log('Avatar URL found:', avatarUrl);
      console.log('Online ID found:', onlineId);
    } catch (err) {
      console.log('Could not fetch full profile (may be private):', err.message);
    }

    return {
      accountId: trophyData.accountId,
      onlineId: onlineId,
      avatarUrl: avatarUrl,
      trophyLevel: trophyData.trophyLevel,
      progress: trophyData.progress,
      tier: trophyData.tier,
      earnedTrophies: trophyData.earnedTrophies,
      // Include the raw data for debugging
      _rawTrophyData: trophyData
    };
  } catch (error) {
    console.error('Error fetching PSN profile:', error);
    throw error;
  }
}

/**
 * Get PSN trophy summary (wrapper for backward compatibility)
 * @param {string} onlineIdOrAccountId - PSN Online ID or Account ID
 * @returns {Promise<Object>} Trophy summary
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

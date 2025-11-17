import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTrophyProfileSummary,
  getProfileFromAccountId
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
 * Uses getProfileFromUserName for exact lookups
 */
export async function getPSNAccountId(onlineId) {
  try {
    if (onlineId.toLowerCase() === 'me') {
      console.log('Special identifier "me" detected');
      return {
        accountId: 'me',
        onlineId: 'me',
        isAuthenticatedUser: true
      };
    }
    
    const authorization = await getAuthorization();
    
    console.log(`Looking up exact profile for Online ID: "${onlineId}"`);
    const profile = await getProfileFromUserName(authorization, onlineId);
    
    console.log('Full response from getProfileFromUserName:', JSON.stringify(profile, null, 2));
    
    // FIX: Extract the correct properties from the response
    const accountId = profile.accountId || profile.id;
    const returnedOnlineId = profile.onlineId || profile.profileName || profile.userName || onlineId;
    
    console.log(`✅ Found exact match: "${returnedOnlineId}" (Account ID: ${accountId})`);
    
    return {
      accountId: accountId,
      onlineId: returnedOnlineId,
      isExactMatch: true
    };
  } catch (error) {
    console.error(`Error looking up PSN user "${onlineId}":`, error.message);
    throw new Error(`PSN user "${onlineId}" not found. Verify username is correct.`);
  }
}

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

export async function getPSNProfile(onlineIdOrAccountId) {
  try {
    const accessToken = await getAccessToken();

    let accountId;
    let onlineId = onlineIdOrAccountId;

    if (onlineIdOrAccountId.toLowerCase() === 'me') {
      console.log(`Using "me" for authenticated user`);
      accountId = 'me';
      onlineId = 'me';
    } else if (/^\d+$/.test(onlineIdOrAccountId)) {
      console.log(`Using numeric account ID: ${onlineIdOrAccountId}`);
      accountId = onlineIdOrAccountId;
    } else {
      console.log(`\n=== EXACT LOOKUP FOR ONLINE ID: "${onlineIdOrAccountId}" ===`);
      const searchData = await getPSNAccountId(onlineIdOrAccountId);
      accountId = searchData.accountId;
      onlineId = searchData.onlineId;
    }

    console.log(`Fetching trophy data for account ID: ${accountId}`);

    const trophyData = await getUserTrophyProfileSummary(
      { accessToken },
      accountId
    );

    console.log('Trophy data fetched successfully');

    let avatarUrl = null;

    try {
      const fullProfile = await getFullProfile(accountId);
      if (fullProfile?.profile?.avatars && fullProfile.profile.avatars.length > 0) {
        avatarUrl = fullProfile.profile.avatars[0].url;
        console.log('Avatar URL found');
      }

      if (fullProfile?.profile?.onlineId) {
        onlineId = fullProfile.profile.onlineId;
      }
    } catch (err) {
      console.log('Could not fetch full profile:', err.message);
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

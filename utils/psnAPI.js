import fetch from 'node-fetch';

// Your NPSSO token from environment
const NPSSO = process.env.NPSSO;

let accessCode = null;
let authorization = null;
let tokenExpire = null;

const CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const REDIRECT_URI = 'com.scee.psxandroid.scecompcall://redirect';

async function exchangeNpssoForAccessCode() {
  if (accessCode && tokenExpire && Date.now() < tokenExpire) return accessCode;

  try {
    const res = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/authorize', {
      method: 'POST',
      headers: {
        'Cookie': `npsso=${NPSSO}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        access_type: 'offline',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'psn:mobile.v2.core psn:clientapp',
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('exchangeNpssoForAccessCode: unexpected content type:', contentType);
      console.error('Response text:', text);
      throw new Error('Expected JSON response but received HTML or other content');
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`exchangeNpssoForAccessCode: HTTP error ${res.status}`, text);
      throw new Error(`HTTP error ${res.status} from Sony Auth`);
    }

    const data = await res.json();

    if (!data.code) {
      console.error('No access code present in response:', data);
      throw new Error('No access code in Sony Auth response');
    }

    accessCode = data.code;
    tokenExpire = Date.now() + (data.expires_in || 6000000) - 300000;
    console.log('Exchange NPSSO for access code successful');
    return accessCode;

  } catch (error) {
    console.error('Error in exchangeNpssoForAccessCode:', error);
    throw error;
  }
}

async function exchangeAccessCodeForAuthTokens() {
  if (authorization && tokenExpire && Date.now() < tokenExpire) return authorization;

  try {
    const code = await exchangeNpssoForAccessCode();

    const res = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: 'b45c94e90176d6b5a2e6c2413e41d35e848d6208ce6a11c3d4887157b0bb5c1a',
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('exchangeAccessCodeForAuthTokens: unexpected content type:', contentType);
      console.error('Response text:', text);
      throw new Error('Expected JSON response but received HTML or other content');
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`exchangeAccessCodeForAuthTokens: HTTP error ${res.status}`, text);
      throw new Error(`HTTP error ${res.status} from Sony Token`);
    }

    const data = await res.json();

    if (!data.access_token) {
      console.error('Access token missing from token exchange response:', data);
      throw new Error('No access token in token exchange response');
    }

    authorization = data;
    tokenExpire = Date.now() + (data.expires_in * 1000 || 3600000) - 300000;
    console.log('Exchange access code for auth tokens successful');
    return authorization;

  } catch (error) {
    console.error('Error in exchangeAccessCodeForAuthTokens:', error);
    throw error;
  }
}

export async function getPSNProfile(onlineId) {
  try {
    const auth = await exchangeAccessCodeForAuthTokens();
    const res = await fetch(`https://m.np.playstation.com/api/userProfile/v1/internal/users/${encodeURIComponent(onlineId)}/profiles/2`, {
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        'X-Platform': 'web',
        'X-Request-ID': 'request_id_placeholder',
        'X-App-Version': '1.0.0',
      },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('getPSNProfile: unexpected content type:', contentType);
      console.error('Response text:', text);
      throw new Error('Expected JSON response but received HTML or other content');
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(`getPSNProfile: HTTP error ${res.status}`, text);
      throw new Error(`Failed to fetch PSN profile for ${onlineId}`);
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching PSN profile:', error);
    throw error;
  }
}

export async function getPSNTrophySummary(onlineId) {
  try {
    const auth = await exchangeAccessCodeForAuthTokens();
    const res = await fetch(`https://m.np.playstation.com/api/trophy/v1/internal/users/${encodeURIComponent(onlineId)}/trophySummary`, {
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        'X-Platform': 'web',
        'X-Request-ID': 'request_id_placeholder',
        'X-App-Version': '1.0.0',
      },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('getPSNTrophySummary: unexpected content type:', contentType);
      console.error('Response text:', text);
      throw new Error('Expected JSON response but received HTML or other content');
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(`getPSNTrophySummary: HTTP error ${res.status}`, text);
      throw new Error(`Failed to fetch PSN trophies for ${onlineId}`);
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching PSN trophy summary:', error);
    throw error;
  }
}

import fetch from 'node-fetch';

// Load NPSSO token from environment
const NPSSO = process.env.NPSSO;

let accessCode = null;
let authorization = null;
let tokenExpire = null;

const CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const REDIRECT_URI = 'com.scee.psxandroid.scecompcall://redirect';

async function exchangeNpssoForAccessCode() {
  if (accessCode && tokenExpire && Date.now() < tokenExpire) {
    return accessCode;
  }
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
    if (!res.ok) {
      const text = await res.text();
      console.error('Error in exchangeNpssoForAccessCode response:', res.status, text);
      throw new Error(`Failed to exchange NPSSO for access code. Status: ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Unexpected response content-type in exchangeNpssoForAccessCode:', contentType, text);
      throw new Error('Expected JSON response but got different content type');
    }
    const data = await res.json();
    if (!data.code) {
      console.error('No code in exchangeNpssoForAccessCode response:', data);
      throw new Error('No access code received from NPSSO exchange');
    }
    accessCode = data.code;
    tokenExpire = Date.now() + (data.expires_in || 6000000) - 300000;
    return accessCode;
  } catch (err) {
    console.error('Exception in exchangeNpssoForAccessCode:', err);
    throw err;
  }
}

async function exchangeAccessCodeForAuthTokens() {
  if (authorization && tokenExpire && Date.now() < tokenExpire) {
    return authorization;
  }
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
    if (!res.ok) {
      const text = await res.text();
      console.error('Error in exchangeAccessCodeForAuthTokens response:', res.status, text);
      throw new Error(`Failed to exchange access code for tokens. Status: ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Unexpected response content-type in exchangeAccessCodeForAuthTokens:', contentType, text);
      throw new Error('Expected JSON response but got different content type');
    }
    const data = await res.json();
    if (!data.access_token) {
      console.error('No access_token in exchangeAccessCodeForAuthTokens response:', data);
      throw new Error('No access token received');
    }
    authorization = data;
    tokenExpire = Date.now() + (data.expires_in * 1000 || 3600000) - 300000;
    return authorization;
  } catch (err) {
    console.error('Exception in exchangeAccessCodeForAuthTokens:', err);
    throw err;
  }
}

export async function getPSNProfile(onlineId) {
  const auth = await exchangeAccessCodeForAuthTokens();
  const res = await fetch(`https://m.np.playstation.com/api/userProfile/v1/internal/users/${encodeURIComponent(onlineId)}/profiles/2`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'X-Platform': 'web',
      'X-Request-ID': 'request_id_placeholder',
      'X-App-Version': '1.0.0',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Error fetching PSN profile:', res.status, text);
    throw new Error(`Failed to fetch PSN profile for ${onlineId}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Unexpected content-type in getPSNProfile:', contentType, text);
    throw new Error('Expected JSON response but got different content type');
  }
  return res.json();
}

export async function getPSNTrophySummary(onlineId) {
  const auth = await exchangeAccessCodeForAuthTokens();
  const res = await fetch(`https://m.np.playstation.com/api/trophy/v1/internal/users/${encodeURIComponent(onlineId)}/trophySummary`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'X-Platform': 'web',
      'X-Request-ID': 'request_id_placeholder',
      'X-App-Version': '1.0.0',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Error fetching PSN trophy summary:', res.status, text);
    throw new Error(`Failed to fetch PSN trophies for ${onlineId}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Unexpected content-type in getPSNTrophySummary:', contentType, text);
    throw new Error('Expected JSON response but got different content type');
  }
  return res.json();
}



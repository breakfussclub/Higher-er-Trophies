import fetch from 'node-fetch';

// Load npsso token from env, e.g. Railway environment variables
const NPSSO = process.env.NPSSO;

let accessCode = null;
let authorization = null;
let tokenExpire = null;

const CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const REDIRECT_URI = 'com.scee.psxandroid.scecompcall://redirect';

// Helper to exchange NPSSO for access code
async function exchangeNpssoForAccessCode() {
  if (accessCode && tokenExpire && Date.now() < tokenExpire) {
    return accessCode;
  }

  const res = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/authorize', {
    method: 'POST',
    headers: {
      Cookie: `npsso=${NPSSO}`,
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

  const data = await res.json();
  if (!data.code) {
    throw new Error('Unable to get access code from NPSSO.');
  }

  accessCode = data.code;
  // expires_in is usually 6000000 milliseconds, set expiration 5 mins early
  tokenExpire = Date.now() + (data.expires_in || 6000000) - 300000;
  return accessCode;
}

// Helper to exchange access code for OAuth authorization tokens
async function exchangeAccessCodeForAuthTokens() {
  if (authorization && tokenExpire && Date.now() < tokenExpire) {
    return authorization;
  }

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

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Unable to obtain access token from access code.');
  }

  authorization = data;
  tokenExpire = Date.now() + (data.expires_in * 1000 || 3600000) - 300000; // expires_in seconds
  return authorization;
}

// Fetch User Profile
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

  if (!res.ok) throw new Error(`Failed to fetch PSN profile for ${onlineId}`);

  return res.json();
}

// Fetch Trophy Summary
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

  if (!res.ok) throw new Error(`Failed to fetch PSN trophies for ${onlineId}`);

  return res.json();
}

// You can add similar functions to fetch user titles, recent trophies, etc.


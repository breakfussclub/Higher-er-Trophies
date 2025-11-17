import fetch from 'node-fetch';

const NPSSO = process.env.NPSSO;

let accessCode = null;
let authorization = null;
let tokenExpire = null;

const CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const REDIRECT_URI = 'com.scee.psxandroid.scecompcall://redirect';

async function exchangeNpssoForAccessCode() {
  if (accessCode && tokenExpire && Date.now() < tokenExpire) {
    console.log('Using cached access code.');
    return accessCode;
  }
  console.log('Exchanging NPSSO for access code...');
  const res = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/authorize', {
    method: 'POST',
    headers: {
      'Cookie': `npsso=${NPSSO}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
      'Origin': 'https://my.playstation.com',
      'Referer': 'https://my.playstation.com/',
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
  if (!res.ok) {
    const text = await res.text();
    console.error(`Token exchange failed with status ${res.status}:`, text);
    throw new Error(`Failed to exchange NPSSO token. Status: ${res.status}`);
  }
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Unexpected content-type for access code exchange:', contentType);
    console.error('Response body:', text);
    throw new Error('Expected JSON response but got different content.');
  }
  const data = await res.json();
  if (!data.code) {
    console.error('No access code in token exchange response:', data);
    throw new Error('No access code received.');
  }
  accessCode = data.code;
  tokenExpire = Date.now() + (data.expires_in || 6000000) - 300000;
  console.log('Access code obtained successfully.');
  return accessCode;
}

async function exchangeAccessCodeForAuthTokens() {
  if (authorization && tokenExpire && Date.now() < tokenExpire) {
    console.log('Using cached OAuth tokens.');
    return authorization;
  }
  console.log('Exchanging access code for OAuth tokens...');
  const code = await exchangeNpssoForAccessCode();
  const res = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
      'Origin': 'https://my.playstation.com',
      'Referer': 'https://my.playstation.com/',
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
  if (!res.ok) {
    const text = await res.text();
    console.error(`OAuth token fetch failed with status ${res.status}:`, text);
    throw new Error(`Failed to exchange access code for tokens. Status: ${res.status}`);
  }
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Unexpected content-type for OAuth token fetch:', contentType);
    console.error('Response body:', text);
    throw new Error('Expected JSON response but got different content.');
  }

  const data = await res.json();
  if (!data.access_token) {
    console.error('No access token in OAuth response:', data);
    throw new Error('No access token received.');
  }
  authorization = data;
  tokenExpire = Date.now() + (data.expires_in * 1000 || 3600000) - 300000;
  console.log('OAuth tokens obtained successfully.');
  return authorization;
}

export async function getPSNProfile(onlineId) {
  console.log(`Fetching PSN profile for ${onlineId}...`);
  const auth = await exchangeAccessCodeForAuthTokens();
  const res = await fetch(`https://m.np.playstation.com/api/userProfile/v1/internal/users/${encodeURIComponent(onlineId)}/profiles/2`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'X-Platform': 'web',
      'X-Request-ID': 'request_id_placeholder',
      'X-App-Version': '1.0.0',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to fetch PSN profile, status ${res.status}:`, text);
    throw new Error(`Failed to fetch PSN profile for ${onlineId}`);
  }
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Unexpected content type for PSN profile:', contentType);
    console.error('Response body:', text);
    throw new Error('Expected JSON response but got different content.');
  }
  return res.json();
}

export async function getPSNTrophySummary(onlineId) {
  console.log(`Fetching PSN trophy summary for ${onlineId}...`);
  const auth = await exchangeAccessCodeForAuthTokens();
  const res = await fetch(`https://m.np.playstation.com/api/trophy/v1/internal/users/${encodeURIComponent(onlineId)}/trophySummary`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'X-Platform': 'web',
      'X-Request-ID': 'request_id_placeholder',
      'X-App-Version': '1.0.0',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to fetch trophy summary, status ${res.status}:`, text);
    throw new Error(`Failed to fetch PSN trophies for ${onlineId}`);
  }
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Unexpected content type for trophy summary:', contentType);
    console.error('Response body:', text);
    throw new Error('Expected JSON response but got different content.');
  }
  return res.json();
}

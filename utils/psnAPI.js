import fetch from 'node-fetch';
import config from '../config.js';

const PSN_API_BASE = 'https://m.np.playstation.com/api';
let accessToken = null;
let tokenExpiry = null;

/**
 * Exchange NPSSO for access token
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    // Step 1: Exchange NPSSO for access code
    const codeResponse = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/authorize', {
      method: 'POST',
      headers: {
        'Cookie': `npsso=${config.psn.npsso}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        access_type: 'offline',
        client_id: '09515159-7237-4370-9b40-3806e67c0891',
        redirect_uri: 'com.scee.psxandroid.scecompcall://redirect',
        response_type: 'code',
        scope: 'psn:mobile.v2.core psn:clientapp'
      })
    });

    const codeData = await codeResponse.json();

    if (!codeData.code) {
      throw new Error('Failed to get access code from NPSSO');
    }

    // Step 2: Exchange code for access token
    const tokenResponse = await fetch('https://ca.account.sony.com/api/authz/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A='
      },
      body: new URLSearchParams({
        code: codeData.code,
        grant_type: 'authorization_code',
        redirect_uri: 'com.scee.psxandroid.scecompcall://redirect',
        token_format: 'jwt'
      })
    });

    const tokenData = await tokenResponse.json();

    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Refresh 1 min early

    return accessToken;
  } catch (error) {
    throw new Error(`PSN authentication failed: ${error.message}`);
  }
}

/**
 * Get PSN user profile
 * @param {string} onlineId - PSN Online ID
 * @returns {Promise<Object>} User profile data
 */
export async function getPSNProfile(onlineId) {
  const token = await getAccessToken();

  const response = await fetch(`${PSN_API_BASE}/userProfile/v1/internal/users/${onlineId}/profiles`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data;
}

/**
 * Get PSN trophy summary
 * @param {string} accountId - PSN Account ID
 * @returns {Promise<Object>} Trophy summary
 */
export async function getPSNTrophySummary(accountId) {
  const token = await getAccessToken();

  const response = await fetch(`${PSN_API_BASE}/trophy/v1/users/${accountId}/trophySummary`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data;
}

/**
 * Get PSN recently played games
 * @param {string} accountId - PSN Account ID
 * @returns {Promise<Array>} Recently played games
 */
export async function getPSNRecentGames(accountId) {
  const token = await getAccessToken();

  const response = await fetch(`${PSN_API_BASE}/gamelist/v2/users/${accountId}/titles`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data.titles || [];
}

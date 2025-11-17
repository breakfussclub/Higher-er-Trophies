import { getXboxProfile } from '../utils/xboxAPI.js';

export async function getXboxStats(xboxName) {
  try {
    const xboxProfile = await getXboxProfile(xboxName);

    const fields = [
      { name: '🎯 Xbox Live Gamertag', value: xboxProfile.gamertag || 'Unknown', inline: true },
      { name: 'Gamerscore', value: xboxProfile.gamerscore?.toString() || '0', inline: true },
      { name: 'Account Tier', value: xboxProfile.accountTier || 'Unknown', inline: true },
      { name: 'Xbox Reputation', value: xboxProfile.xboxOneRep || 'Unknown', inline: true }
    ];

    return fields;
  } catch (error) {
    console.error('Error fetching Xbox stats:', error);
    return [{ name: 'Xbox Live', value: '⚠️ Could not fetch Xbox data', inline: false }];
  }
}

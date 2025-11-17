import { getPSNProfile, getPSNTrophySummary } from '../utils/psnAPI.js';

export async function getPSNStats(psnOnlineId) {
  try {
    const psnProfile = await getPSNProfile(psnOnlineId);
    const trophies = await getPSNTrophySummary(psnProfile.accountId);

    const fields = [
      { name: '🏆 PSN Online ID', value: psnOnlineId, inline: true },
      { name: 'Trophy Level', value: trophies.trophyLevel?.toString() || 'N/A', inline: true },
      { name: 'Gold Trophies', value: trophies.earnedTrophies?.gold?.toString() || '0', inline: true },
      { name: 'Silver Trophies', value: trophies.earnedTrophies?.silver?.toString() || '0', inline: true },
      { name: 'Bronze Trophies', value: trophies.earnedTrophies?.bronze?.toString() || '0', inline: true },
      { name: 'Total Trophies', value: trophies.earnedTrophies?.total?.toString() || '0', inline: true }
    ];

    return fields;
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return [{ name: 'PlayStation Network', value: '⚠️ Could not fetch PSN data', inline: false }];
  }
}

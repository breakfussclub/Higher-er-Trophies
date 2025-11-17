import { getPSNProfile, getPSNTrophySummary } from '../utils/psnAPI.js';

function getTrophyEmoji(type) {
  const emojis = {
    platinum: '🏆',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉'
  };
  return emojis[type] || '🏅';
}

export async function getPSNStats(psnOnlineId) {
  try {
    const psnProfileResponse = await getPSNProfile(psnOnlineId);
    const psnProfile = psnProfileResponse.profile; // Adjust based on your API response structure

    const trophySummaryResponse = await getPSNTrophySummary(psnOnlineId);
    const trophySummary = trophySummaryResponse.trophySummary; // Adjust as per actual data

    // Dynamic embed color based on trophy level
    let embedColor = 0x003087; // PSN Blue default
    if (trophySummary?.level >= 500) embedColor = 0xFFD700; // Gold
    else if (trophySummary?.level >= 200) embedColor = 0xC0C0C0; // Silver

    const fields = [
      { name: 'PSN Online ID', value: psnProfile.onlineId || psnOnlineId, inline: true },
      { name: 'PSN Level', value: `🎚️ ${trophySummary?.level ?? 'N/A'}`, inline: true },
      { name: 'Platinum', value: `${getTrophyEmoji('platinum')} ${trophySummary?.earnedTrophies?.platinum ?? 0}`, inline: true },
      { name: 'Gold', value: `${getTrophyEmoji('gold')} ${trophySummary?.earnedTrophies?.gold ?? 0}`, inline: true },
      { name: 'Silver', value: `${getTrophyEmoji('silver')} ${trophySummary?.earnedTrophies?.silver ?? 0}`, inline: true },
      { name: 'Bronze', value: `${getTrophyEmoji('bronze')} ${trophySummary?.earnedTrophies?.bronze ?? 0}`, inline: true },
      { name: 'Total', value: `🏅 ${trophySummary?.earnedTrophies?.total ?? 0}`, inline: true }
    ];

    return {
      thumbnail: psnProfile?.avatarUrl ?? null,
      author: {
        name: psnProfile?.onlineId ?? psnOnlineId,
        iconURL: psnProfile?.avatarUrl ?? undefined,
        url: `https://psnprofiles.com/${psnProfile?.onlineId ?? psnOnlineId}`,
      },
      color: embedColor,
      fields
    };
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return {
      fields: [{ name: 'PlayStation Network', value: '⚠️ Could not fetch PSN data. Profile may be private or invalid.', inline: false }]
    };
  }
}

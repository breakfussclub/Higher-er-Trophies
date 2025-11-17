import { 
  getPSNProfile, 
  getPSNTrophySummary, 
  getPSNRecentGames,
  getPSNRecentTrophies 
} from '../utils/psnAPI.js';

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
    const psnProfile = await getPSNProfile(psnOnlineId);
    const trophySummary = await getPSNTrophySummary(psnOnlineId);
    const recentTrophies = await getPSNRecentTrophies(psnOnlineId).catch(() => []);

    // Dynamic color based on trophy level
    let embedColor = 0x003087; // PSN Blue default
    if (trophySummary.trophyLevel >= 500) embedColor = 0xFFD700; // Gold
    else if (trophySummary.trophyLevel >= 200) embedColor = 0xC0C0C0; // Silver

    // Format recent trophies
    let recentTrophiesDisplay = '';
    if (recentTrophies.length > 0) {
      recentTrophiesDisplay = recentTrophies
        .slice(0, 3)
        .map(t => `${getTrophyEmoji(t.trophyType)} **${t.trophyName}** — ${t.trophyDetail || 'No description'}`)
        .join('\n');
    } else {
      recentTrophiesDisplay = 'No recent trophies';
    }

    const embedFields = [
      { name: 'PSN Level', value: `🎚️ ${trophySummary.trophyLevel ?? 'N/A'}`, inline: true },
      { name: 'Platinum', value: `🏆 ${trophySummary.earnedTrophies?.platinum ?? 0}`, inline: true },
      { name: 'Gold', value: `🥇 ${trophySummary.earnedTrophies?.gold ?? 0}`, inline: true },
      { name: 'Silver', value: `🥈 ${trophySummary.earnedTrophies?.silver ?? 0}`, inline: true },
      { name: 'Bronze', value: `🥉 ${trophySummary.earnedTrophies?.bronze ?? 0}`, inline: true },
      { name: 'Total Trophies', value: `🏅 ${trophySummary.earnedTrophies?.total ?? 0}`, inline: true },
      {
        name: '**Recent Trophies**',
        value: recentTrophiesDisplay,
        inline: false
      }
    ];

    return {
      thumbnail: psnProfile.avatarUrl || null,
      author: {
        name: psnProfile.onlineId,
        iconURL: psnProfile.avatarUrl || undefined,
        url: `https://psnprofiles.com/${psnProfile.onlineId}`
      },
      color: embedColor,
      fields: embedFields
    };

  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return {
      fields: [{ name: 'PlayStation Network', value: '⚠️ Could not fetch PSN data. Profile may be private or invalid.', inline: false }]
    };
  }
}

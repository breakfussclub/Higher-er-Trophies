import { getPSNProfile, getPSNAccountId } from '../utils/psnAPI.js';

function getTrophyEmoji(type) {
  const emojis = {
    platinum: '🏆',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉'
  };
  return emojis[type] || '🏅';
}

export async function getPSNStats(onlineIdOrAccountId) {
  try {
    const profile = await getPSNProfile(onlineIdOrAccountId);
    
    // Dynamic embed color based on trophy level
    let embedColor = 0x003087; // PSN Blue default
    if (profile.trophyLevel >= 500) embedColor = 0xFFD700; // Gold
    else if (profile.trophyLevel >= 200) embedColor = 0xC0C0C0; // Silver
    else if (profile.trophyLevel >= 100) embedColor = 0xCD7F32; // Bronze

    const fields = [
      { 
        name: 'PSN Level', 
        value: `🎚️ Level ${profile.trophyLevel} (Tier ${profile.tier})`, 
        inline: true 
      },
      { 
        name: 'Progress', 
        value: `📊 ${profile.progress}%`, 
        inline: true 
      },
      { 
        name: '\u200b', 
        value: '\u200b', 
        inline: true 
      },
      { 
        name: 'Platinum', 
        value: `${getTrophyEmoji('platinum')} ${profile.earnedTrophies.platinum}`, 
        inline: true 
      },
      { 
        name: 'Gold', 
        value: `${getTrophyEmoji('gold')} ${profile.earnedTrophies.gold}`, 
        inline: true 
      },
      { 
        name: 'Silver', 
        value: `${getTrophyEmoji('silver')} ${profile.earnedTrophies.silver}`, 
        inline: true 
      },
      { 
        name: 'Bronze', 
        value: `${getTrophyEmoji('bronze')} ${profile.earnedTrophies.bronze}`, 
        inline: true 
      },
      { 
        name: 'Total Trophies', 
        value: `🏅 ${profile.earnedTrophies.bronze + profile.earnedTrophies.silver + profile.earnedTrophies.gold + profile.earnedTrophies.platinum}`, 
        inline: true 
      }
    ];

    // Determine display name - if it's a numeric account ID, don't show it
    let displayOnlineId = onlineIdOrAccountId;
    let profileUrl = null;
    
    // If input was an online ID (not numeric), use it for the profile URL
    if (!/^\d+$/.test(onlineIdOrAccountId)) {
      displayOnlineId = onlineIdOrAccountId;
      profileUrl = `https://psnprofiles.com/${onlineIdOrAccountId}`;
    } else {
      // It's a numeric account ID, just show "PSN Account"
      displayOnlineId = 'PSN Account';
      // Don't set a URL since we don't have the online ID
    }

    return {
      thumbnail: null,
      author: profileUrl ? {
        name: displayOnlineId,
        iconURL: undefined,
        url: profileUrl,
      } : {
        name: displayOnlineId,
        iconURL: undefined
      },
      color: embedColor,
      fields
    };
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return {
      fields: [{ 
        name: 'PlayStation Network', 
        value: `⚠️ Could not fetch PSN data: ${error.message}\n\nMake sure the profile is public and the username is correct.`, 
        inline: false 
      }]
    };
  }
}

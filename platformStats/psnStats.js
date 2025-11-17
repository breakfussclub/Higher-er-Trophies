import { getPSNProfile, getFullProfile } from '../utils/psnAPI.js';

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

    // Get additional profile info (avatar, online ID)
    let avatarUrl = null;
    let displayOnlineId = onlineIdOrAccountId;
    let profileUrl = null;
    
    try {
      // Get full profile data including avatar
      const fullProfile = await getFullProfile(profile.accountId);
      
      // Get avatar URL (use the largest available)
      if (fullProfile.profile?.avatars?.length > 0) {
        avatarUrl = fullProfile.profile.avatars[0].url;
      }
      
      // Get online ID
      if (fullProfile.profile?.onlineId) {
        displayOnlineId = fullProfile.profile.onlineId;
        profileUrl = `https://psnprofiles.com/${fullProfile.profile.onlineId}`;
      }
    } catch (err) {
      // If profile fetch fails, use what we have
      console.log('Could not fetch full profile info (may be private):', err.message);
      
      // Fallback: if original input was an online ID, use it
      if (!/^\d+$/.test(onlineIdOrAccountId)) {
        displayOnlineId = onlineIdOrAccountId;
        profileUrl = `https://psnprofiles.com/${onlineIdOrAccountId}`;
      } else {
        displayOnlineId = 'PSN Account';
      }
    }

    return {
      thumbnail: avatarUrl,
      author: profileUrl ? {
        name: displayOnlineId,
        iconURL: avatarUrl,
        url: profileUrl,
      } : {
        name: displayOnlineId,
        iconURL: avatarUrl
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

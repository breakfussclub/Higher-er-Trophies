import { getPSNProfile, getPSNAccountId } from '../utils/psnAPI.js';
import { makeUniversalSearch } from 'psn-api';

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

    // Try to get user info for profile picture and online ID
    let avatarUrl = null;
    let displayOnlineId = onlineIdOrAccountId;
    
    try {
      // If we have an account ID, we can try to get additional profile info
      if (/^\d+$/.test(onlineIdOrAccountId)) {
        // We'd need to implement getProfileFromAccountId from psn-api
        // For now, just use the accountId
        displayOnlineId = `Account ${profile.accountId}`;
      }
    } catch (err) {
      // If profile lookup fails, just continue with basic info
      console.log('Could not fetch additional profile info:', err.message);
    }

    return {
      thumbnail: avatarUrl,
      author: {
        name: displayOnlineId,
        iconURL: avatarUrl,
        url: `https://psnprofiles.com/${displayOnlineId}`,
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

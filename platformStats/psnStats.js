import { getPSNProfile } from '../utils/psnAPI.js';

function getTrophyEmoji(type) {
  const emojis = {
    platinum: '🏆',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉'
  };
  return emojis[type] || '🏅';
}

function getTierEmoji(tier) {
  const tierMap = {
    1: '🥉',
    2: '🥈', 
    3: '🥇',
    4: '💎',
    5: '👑',
    6: '⭐',
    7: '🌟',
    8: '💫',
    9: '✨'
  };
  return tierMap[tier] || '🎮';
}

export async function getPSNStats(onlineIdOrAccountId) {
  try {
    const profile = await getPSNProfile(onlineIdOrAccountId);
    
    console.log('PSN Profile Data:', profile);
    
    // Dynamic embed color based on trophy level
    let embedColor = 0x003087; // PSN Blue default
    if (profile.trophyLevel >= 500) embedColor = 0xFFD700; // Gold
    else if (profile.trophyLevel >= 300) embedColor = 0xE5E4E2; // Platinum
    else if (profile.trophyLevel >= 200) embedColor = 0xC0C0C0; // Silver
    else if (profile.trophyLevel >= 100) embedColor = 0xCD7F32; // Bronze

    // Calculate total trophies
    const totalTrophies = 
      profile.earnedTrophies.bronze + 
      profile.earnedTrophies.silver + 
      profile.earnedTrophies.gold + 
      profile.earnedTrophies.platinum;

    const fields = [
      { 
        name: 'PSN Level', 
        value: `${getTierEmoji(profile.tier)} **Level ${profile.trophyLevel}** (Tier ${profile.tier})`, 
        inline: true 
      },
      { 
        name: 'Progress', 
        value: `📊 **${profile.progress}%** to next level`, 
        inline: true 
      },
      { 
        name: 'Account ID', 
        value: `\`${profile.accountId}\``, 
        inline: true 
      },
      { 
        name: `${getTrophyEmoji('platinum')} Platinum`, 
        value: `**${profile.earnedTrophies.platinum}**`, 
        inline: true 
      },
      { 
        name: `${getTrophyEmoji('gold')} Gold`, 
        value: `**${profile.earnedTrophies.gold}**`, 
        inline: true 
      },
      { 
        name: `${getTrophyEmoji('silver')} Silver`, 
        value: `**${profile.earnedTrophies.silver}**`, 
        inline: true 
      },
      { 
        name: `${getTrophyEmoji('bronze')} Bronze`, 
        value: `**${profile.earnedTrophies.bronze}**`, 
        inline: true 
      },
      { 
        name: '🏅 Total Trophies', 
        value: `**${totalTrophies.toLocaleString()}**`, 
        inline: true 
      },
      { 
        name: '\u200b', 
        value: '\u200b', 
        inline: true 
      }
    ];

    return {
      thumbnail: profile.avatarUrl,
      author: {
        name: `${profile.onlineId} - PlayStation Network`,
        iconURL: profile.avatarUrl,
        url: `https://psnprofiles.com/${profile.onlineId}`,
      },
      footer: {
        text: '🎮 PlayStation Network • Trophy data synced from PSN',
        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PlayStation_logo.svg/200px-PlayStation_logo.svg.png'
      },
      color: embedColor,
      fields
    };
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return {
      fields: [{ 
        name: 'PlayStation Network', 
        value: `⚠️ Could not fetch PSN data: ${error.message}\n\nMake sure:\n• Profile is public\n• Trophies are visible to "Anyone"\n• Username is correct`, 
        inline: false 
      }]
    };
  }
}

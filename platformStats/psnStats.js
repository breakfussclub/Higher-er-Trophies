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

function getTierName(tier) {
  const tierNames = {
    1: 'Bronze',
    2: 'Silver', 
    3: 'Gold',
    4: 'Diamond',
    5: 'Crown',
    6: 'Star',
    7: 'Superstar',
    8: 'Stellar',
    9: 'Legendary'
  };
  return tierNames[tier] || 'Gamer';
}

export async function getPSNStats(onlineIdOrAccountId) {
  try {
    console.log(`=== FETCHING PSN STATS FOR: ${onlineIdOrAccountId} ===`);
    const profile = await getPSNProfile(onlineIdOrAccountId);
    
    console.log('=== COMPLETE PROFILE DATA ===');
    console.log(JSON.stringify(profile, null, 2));

    // Validate profile data exists
    if (!profile || !profile.earnedTrophies) {
      throw new Error('Invalid profile data received from PSN API');
    }

    // Dynamic embed color based on trophy level
    let embedColor = 0x003087; // PSN Blue default
    const level = profile.trophyLevel || 0;
    
    if (level >= 500) embedColor = 0xFFD700;      // Gold
    else if (level >= 300) embedColor = 0xE5E4E2; // Platinum
    else if (level >= 200) embedColor = 0xC0C0C0; // Silver
    else if (level >= 100) embedColor = 0xCD7F32; // Bronze

    // Safe access with defaults
    const bronze = profile.earnedTrophies.bronze || 0;
    const silver = profile.earnedTrophies.silver || 0;
    const gold = profile.earnedTrophies.gold || 0;
    const platinum = profile.earnedTrophies.platinum || 0;
    
    const totalTrophies = bronze + silver + gold + platinum;

    console.log(`=== TROPHY BREAKDOWN ===`);
    console.log(`Platinum: ${platinum}`);
    console.log(`Gold: ${gold}`);
    console.log(`Silver: ${silver}`);
    console.log(`Bronze: ${bronze}`);
    console.log(`TOTAL: ${totalTrophies}`);
    console.log(`Avatar URL: ${profile.avatarUrl}`);

    // Build enhanced fields array with better visual hierarchy
    const fields = [
      {
        name: '🎮 Level & Tier',
        value: `${getTierEmoji(profile.tier)} **Level ${profile.trophyLevel}** • ${getTierName(profile.tier)} Tier ${profile.tier}`,
        inline: true
      },
      {
        name: '📈 Progress to Next Level',
        value: `**${profile.progress}%**`,
        inline: true
      },
      {
        name: '\u200b',
        value: '\u200b',
        inline: true
      },
      {
        name: `${getTrophyEmoji('platinum')} Platinum`,
        value: `**${platinum.toLocaleString()}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('gold')} Gold`,
        value: `**${gold.toLocaleString()}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('silver')} Silver`,
        value: `**${silver.toLocaleString()}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('bronze')} Bronze`,
        value: `**${bronze.toLocaleString()}**`,
        inline: true
      },
      {
        name: '🏅 Total Earned',
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
      title: `🎮 ${profile.onlineId}'s PlayStation Profile`,
      description: `*Trophy Hunter • ${getTierName(profile.tier)} Tier • PSN Level ${profile.trophyLevel}*`,
      thumbnail: { url: profile.avatarUrl },  // Small avatar top-right
      author: {
        name: profile.onlineId,
        icon_url: profile.avatarUrl,  // Small avatar next to name
      },
      url: `https://psnprofiles.com/${profile.onlineId}`,
      footer: {
        text: '🎮 PlayStation Network • Trophy data synced from PSN',
        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PlayStation_logo.svg/200px-PlayStation_logo.svg.png'
      },
      color: embedColor,
      fields,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return {
      title: '⚠️ PlayStation Network Error',
      description: 'Unable to fetch PSN profile data',
      color: 0xFF0000,
      fields: [{
        name: 'Error Details',
        value: `\`\`\`${error.message}\`\`\`\n**Troubleshooting:**\n• Ensure profile is set to public\n• Check that trophies are visible to "Anyone"\n• Verify the username is correct\n• Try again in a few moments`,
        inline: false
      }]
    };
  }
}

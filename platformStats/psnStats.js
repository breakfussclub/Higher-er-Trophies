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
    console.log(`=== FETCHING PSN STATS FOR: ${onlineIdOrAccountId} ===`);
    const profile = await getPSNProfile(onlineIdOrAccountId);
    console.log('=== COMPLETE PROFILE DATA ===');
    console.log(JSON.stringify(profile, null, 2));

    // Dynamic embed color based on trophy level
    let embedColor = 0x003087; // PSN Blue default
    if (profile.trophyLevel >= 500) embedColor = 0xFFD700; // Gold
    else if (profile.trophyLevel >= 300) embedColor = 0xE5E4E2; // Platinum
    else if (profile.trophyLevel >= 200) embedColor = 0xC0C0C0; // Silver
    else if (profile.trophyLevel >= 100) embedColor = 0xCD7F32; // Bronze

    // Calculate total and completion stats
    const totalTrophies =
      profile.earnedTrophies.bronze +
      profile.earnedTrophies.silver +
      profile.earnedTrophies.gold +
      profile.earnedTrophies.platinum;

    const fields = [
      // Header section with level and progress
      {
        name: `${getTierEmoji(profile.tier)} PSN Level`,
        value: `**${profile.trophyLevel}** (Tier ${profile.tier})`,
        inline: true
      },
      {
        name: '📊 Progress to Next',
        value: `**${profile.progress}%**`,
        inline: true
      },
      {
        name: '🏅 Total Trophies',
        value: `**${totalTrophies.toLocaleString()}**`,
        inline: true
      },
      // Trophy breakdown - organized neatly
      {
        name: '\u200B', // Invisible separator
        value: '\u200B',
        inline: false
      },
      {
        name: `${getTrophyEmoji('platinum')} Platinum Trophies`,
        value: `**${profile.earnedTrophies.platinum}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('gold')} Gold Trophies`,
        value: `**${profile.earnedTrophies.gold}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('silver')} Silver Trophies`,
        value: `**${profile.earnedTrophies.silver}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('bronze')} Bronze Trophies`,
        value: `**${profile.earnedTrophies.bronze}**`,
        inline: true
      }
    ];

    return {
      thumbnail: profile.avatarUrl,
      author: {
        name: `${profile.onlineId} - PlayStation Network`,
        iconURL: profile.avatarUrl
      },
      footer: {
        text: '🎮 PlayStation Network • Trophy data synced from PSN • Today'
      },
      color: embedColor,
      fields
    };

  } catch (error) {
    console.error('Error fetching PSN stats:', error.message);
    return {
      fields: [{
        name: '❌ PlayStation Network',
        value: `Error: ${error.message}\n\n**Please verify:**\n• Your PSN Online ID is spelled correctly\n• Your profile is public\n• Trophies are visible to "Anyone"`,
        inline: false
      }]
    };
  }
}

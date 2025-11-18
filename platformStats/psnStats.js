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
    console.log(`[PSN Stats] Fetching for: ${onlineIdOrAccountId}`);
    const profile = await getPSNProfile(onlineIdOrAccountId);

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

    // Build fields in Steam-like format: inline stats at top, then larger sections
    const fields = [
      // Top row: Level, Progress, Total Trophies (inline)
      {
        name: `${getTierEmoji(profile.tier)} PSN Level`,
        value: `**${profile.trophyLevel}** (Tier ${profile.tier})`,
        inline: true
      },
      {
        name: '📊 Progress',
        value: `**${profile.progress}%** to next`,
        inline: true
      },
      {
        name: '🏅 Total Trophies',
        value: `**${totalTrophies.toLocaleString()}**`,
        inline: true
      },
      // Trophy breakdown row (inline)
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
      }
    ];

    return {
      thumbnail: profile.avatarUrl || undefined,
      author: {
        name: `${profile.onlineId} - PlayStation Network`,
        iconURL: profile.avatarUrl || undefined,
        url: `https://psnprofiles.com/${profile.onlineId}`
      },
      footer: {
        text: '🎮 PlayStation Network • Trophy data synced from PSN • Today'
      },
      color: embedColor,
      fields
    };

  } catch (error) {
    console.error('[PSN Stats] Error:', error.message);
    return {
      fields: [{
        name: 'PlayStation Network',
        value: `⚠️ Could not fetch PSN data: ${error.message}\n\nMake sure:\n• Profile is public\n• Trophies are visible to "Anyone"\n• Username is correct`,
        inline: false
      }]
    };
  }
}

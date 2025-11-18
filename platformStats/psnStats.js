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

    // Calculate total trophies
    const totalTrophies =
      profile.earnedTrophies.bronze +
      profile.earnedTrophies.silver +
      profile.earnedTrophies.gold +
      profile.earnedTrophies.platinum;

    // PlayStation Blue color
    const embedColor = 0x003087;

    const fields = [
      // Main stats - vertical layout
      {
        name: `${getTierEmoji(profile.tier)} PSN Level`,
        value: `**${profile.trophyLevel}** (Tier ${profile.tier})`,
        inline: false
      },
      {
        name: '📊 Progress to Next',
        value: `**${profile.progress}%**`,
        inline: false
      },
      {
        name: '🏅 Total Trophies',
        value: `**${totalTrophies.toLocaleString()}**`,
        inline: false
      },

      // Trophy breakdown - vertical sections
      {
        name: `${getTrophyEmoji('platinum')} Platinum`,
        value: `**${profile.earnedTrophies.platinum}**`,
        inline: false
      },
      {
        name: `${getTrophyEmoji('gold')} Gold`,
        value: `**${profile.earnedTrophies.gold}**`,
        inline: false
      },
      {
        name: `${getTrophyEmoji('silver')} Silver`,
        value: `**${profile.earnedTrophies.silver}**`,
        inline: false
      },
      {
        name: `${getTrophyEmoji('bronze')} Bronze`,
        value: `**${profile.earnedTrophies.bronze}**`,
        inline: false
      }
    ];

    return {
      author: {
        name: `${profile.onlineId} - PlayStation Network`,
        iconURL: profile.avatarUrl
      },
      thumbnail: profile.avatarUrl,
      color: embedColor,
      fields: fields,
      footer: {
        text: 'PSN Trophy Data • Synced from PlayStation Network'
      }
    };

  } catch (error) {
    console.error('[PSN Stats] Error:', error.message);
    return {
      fields: [{
        name: '❌ PlayStation Network Error',
        value: `${error.message}`,
        inline: false
      }],
      color: 0xFF0000
    };
  }
}

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
    1: '🥉 Bronze',
    2: '🥈 Silver',
    3: '🥇 Gold',
    4: '💎 Sapphire',
    5: '👑 Platinum',
    6: '⭐ Gold Prestige',
    7: '🌟 Silver Prestige',
    8: '💫 Bronze Prestige',
    9: '✨ Legendary'
  };
  return tierMap[tier] || '🎮 Standard';
}

function getTierColor(tier) {
  const colors = {
    1: 0x8B4513, // Bronze
    2: 0xC0C0C0, // Silver
    3: 0xFFD700, // Gold
    4: 0x0F52BA, // Sapphire
    5: 0xE5E4E2, // Platinum
    6: 0xFFD700, // Gold Prestige
    7: 0xC0C0C0, // Silver Prestige
    8: 0x8B4513, // Bronze Prestige
    9: 0x00BFFF  // Legendary
  };
  return colors[tier] || 0x003087;
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

    // Determine embed color (PSN Blue as primary, tier color as accent)
    const embedColor = 0x003087; // PlayStation Blue

    const fields = [
      // Row 1: Core Stats (PSN Level, Progress, Total)
      {
        name: '🎮 PSN Level',
        value: `**${profile.trophyLevel}**`,
        inline: true
      },
      {
        name: '📊 Progress',
        value: `**${profile.progress}%**`,
        inline: true
      },
      {
        name: '🏅 Total Trophies',
        value: `**${totalTrophies.toLocaleString()}**`,
        inline: true
      },

      // Row 2: Tier Info
      {
        name: '🏆 Trophy Tier',
        value: `**${getTierEmoji(profile.tier)}**`,
        inline: true
      },
      {
        name: '\u200B', // Invisible spacer
        value: '\u200B',
        inline: true
      },
      {
        name: '\u200B', // Invisible spacer
        value: '\u200B',
        inline: true
      },

      // Visual separator
      {
        name: '\u200B',
        value: '━━━━━━━━━━━━━━━━━━━━',
        inline: false
      },

      // Trophy Breakdown - 2x2 Grid
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
      title: `${profile.onlineId} - PlayStation Network`,
      thumbnail: {
        url: profile.avatarUrl || undefined
      },
      color: embedColor,
      fields: fields,
      footer: {
        text: '🎮 PSN Trophy Data • Synced from PlayStation Network'
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[PSN Stats] Error:', error.message);
    return {
      title: '❌ PlayStation Network Error',
      color: 0xFF0000,
      fields: [{
        name: 'Failed to Load Stats',
        value: `**Error:** ${error.message}\n\n**Troubleshooting:**\n• Verify your PSN Online ID spelling\n• Ensure your profile is **Public**\n• Check that trophies are visible to **"Anyone"**\n• Try using your numeric PSN Account ID if issues persist`,
        inline: false
      }],
      footer: {
        text: '🎮 PSN Trophy Data • Error occurred'
      }
    };
  }
}

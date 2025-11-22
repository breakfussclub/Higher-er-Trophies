import { getPSNProfile, getPSNUserTitles, getPSNTitleTrophies } from '../services/psnService.js';

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

    // Validate profile data exists
    if (!profile || !profile.earnedTrophies) {
      throw new Error('Invalid profile data received from PSN API');
    }

    // Fetch Recent Trophies
    let recentTrophiesDisplay = '';
    try {
      // 1. Get recent titles
      console.log('Fetching PSN user titles...');
      const titlesResponse = await getPSNUserTitles(profile.accountId);
      console.log(`Titles found: ${titlesResponse?.titles?.length || 0}`);

      if (titlesResponse && titlesResponse.titles && titlesResponse.titles.length > 0) {
        // 2. Get the most recent title
        const lastTitle = titlesResponse.titles[0]; // Assuming API returns sorted by recent
        console.log(`Most recent title: ${lastTitle.name} (${lastTitle.npCommunicationId})`);

        // 3. Get trophies for this title
        const trophiesResponse = await getPSNTitleTrophies(profile.accountId, lastTitle.npCommunicationId, 'default');
        console.log(`Trophies response: ${trophiesResponse ? 'Received' : 'Null'}`);

        if (trophiesResponse && trophiesResponse.trophies) {
          // 4. Filter for earned and sort by date
          const earned = trophiesResponse.trophies
            .filter(t => t.earned)
            .sort((a, b) => new Date(b.earnedDateTime) - new Date(a.earnedDateTime))
            .slice(0, 3);

          console.log(`Recent earned trophies: ${earned.length}`);

          if (earned.length > 0) {
            recentTrophiesDisplay = earned.map(t => {
              const emoji = getTrophyEmoji(t.trophyType);
              const name = t.trophyName || 'Unknown Trophy';
              const desc = t.trophyDetail || 'No description';
              return `${emoji} **${name}** (${lastTitle.name})\n   └─ ${desc}`;
            }).join('\n');
          }
        }
      }
    } catch (err) {
      console.log('Could not fetch PSN recent trophies:', err.message);
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

    // Build fields array with correct syntax - FIXED opening braces
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
        name: 'Online ID',
        value: `\`${profile.onlineId}\``,
        inline: true
      },
      {
        name: `${getTrophyEmoji('platinum')} Platinum`,
        value: `**${platinum}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('gold')} Gold`,
        value: `**${gold}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('silver')} Silver`,
        value: `**${silver}**`,
        inline: true
      },
      {
        name: `${getTrophyEmoji('bronze')} Bronze`,
        value: `**${bronze}**`,
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

    // Add Latest Trophies if found
    if (recentTrophiesDisplay) {
      fields.push({
        name: '━━━━━━━━━━━━━━━━━━━━━',
        value: '**Latest Trophies**',
        inline: false
      });
      fields.push({
        name: '\u200b',
        value: recentTrophiesDisplay,
        inline: false
      });
    }

    return {
      thumbnail: profile.avatarUrl,
      author: {
        name: `${profile.onlineId} - PlayStation Network`,
        iconURL: profile.avatarUrl,
        url: `https://psnprofiles.com/${profile.onlineId}`
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

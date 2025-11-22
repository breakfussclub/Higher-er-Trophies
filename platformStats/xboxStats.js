import { getXboxProfile, searchGamertag, getXboxAchievements, getTitleAchievements, getRecentAchievements } from '../services/xboxService.js';

function getReputationDisplay(rep) {
  const repMap = {
    'GoodPlayer': '✅ Good Player',
    'Good': '✅ Good',
    'NeedsWork': '⚡ Needs Work',
    'AvoidMe': '⚠️ Avoid Me',
    'Unknown': '❓ Unknown'
  };
  return repMap[rep] || '❓ Unknown';
}

function getTierDisplay(tier) {
  const tierMap = {
    'Gold': '🥇 Gold',
    'Silver': '🥈 Silver',
    'Bronze': '🥉 Bronze',
    'Unknown': '⭐ Standard'
  };
  return tierMap[tier] || '⭐ Standard';
}

function formatTenure(tenure) {
  if (!tenure) return null;

  // Tenure is typically in format like "Y4" for 4 years
  const match = tenure.match(/Y(\d+)/);
  if (match) {
    const years = parseInt(match[1]);
    if (years >= 10) return `🏆 ${years} Year Veteran`;
    if (years >= 5) return `🎖️ ${years} Years`;
    return `📅 ${years} Year${years !== 1 ? 's' : ''}`;
  }
  return null;
}

export async function getXboxStats(xboxGamertag) {
  try {
    console.log(`Fetching Xbox stats for: ${xboxGamertag}`);
    const xboxProfile = await getXboxProfile(xboxGamertag);

    console.log('Xbox profile received:', xboxProfile);

    // Try to get presence/activity data
    let presenceData = null;
    try {
      // Get search result which includes more details
      const searchResult = await searchGamertag(xboxGamertag);
      presenceData = searchResult;
    } catch (err) {
      console.log('Could not fetch Xbox presence:', err.message);
    }

    // Fetch recent achievements
    let recentAchievementsDisplay = '';
    try {
      const titlesData = await getXboxAchievements(xboxProfile.xuid);

      if (titlesData && titlesData.titles && titlesData.titles.length > 0) {
        // Sort by last unlock to get the most recent game
        const recentTitles = titlesData.titles.sort((a, b) => new Date(b.lastUnlock) - new Date(a.lastUnlock));
        const lastTitle = recentTitles[0];

        if (lastTitle) {
          // Now fetch achievements for this specific title
          // FIXED: Parameter order was wrong (titleId, xuid)
          console.log(`Fetching achievements for title: ${lastTitle.name} (${lastTitle.titleId})`);
          const achievementsForTitle = await getTitleAchievements(lastTitle.titleId, xboxProfile.xuid);

          console.log(`Achievements response type: ${typeof achievementsForTitle}`); // DEBUG
          console.log('Raw Xbox Title Achievements:', JSON.stringify(achievementsForTitle, null, 2)); // DEBUG

          if (achievementsForTitle && Array.isArray(achievementsForTitle.achievements) && achievementsForTitle.achievements.length > 0) {
            const unlocked = achievementsForTitle.achievements
              .filter(a => a.progressState === 'Achieved')
              .sort((a, b) => new Date(b.progression.timeUnlocked) - new Date(a.progression.timeUnlocked))
              .slice(0, 3);

            if (unlocked.length > 0) {
              recentAchievementsDisplay = unlocked.map(a => {
                const emoji = '🏆'; // Standard trophy emoji
                const name = a.name || 'Unknown Achievement';
                const desc = a.description || 'No description';
                return `${emoji} **${name}** (${lastTitle.name})\n   └─ ${desc}`;
              }).join('\n');
            }
          } else {
            // Fallback: Try getting recent achievements from the general endpoint if title-specific fails
            console.log('Title achievements empty, trying general recent achievements...');
            const recentAch = await getRecentAchievements(xboxProfile.xuid);
            if (recentAch && recentAch.length > 0) {
              recentAchievementsDisplay = recentAch.slice(0, 3).map(a => {
                const emoji = '🏆';
                const name = a.name || 'Unknown Achievement';
                const desc = a.description || 'No description';
                const gameName = a.titleAssociations && a.titleAssociations.length > 0 ? a.titleAssociations[0].name : 'Unknown Game';
                return `${emoji} **${name}** (${gameName})\n   └─ ${desc}`;
              }).join('\n');
            }
          }
        }
      }
    } catch (err) {
      console.log('Could not fetch Xbox achievements:', err.message);
    }


    // Format gamerscore with commas
    const formattedGamerscore = xboxProfile.gamerscore?.toLocaleString() || '0';

    // Dynamic embed color based on account tier
    let embedColor = 0x107C10; // Xbox Green default
    if (xboxProfile.accountTier === 'Gold') embedColor = 0xFFD700; // Gold
    else if (xboxProfile.accountTier === 'Silver') embedColor = 0xC0C0C0; // Silver

    // Build fields array
    const fields = [
      {
        name: '━━━━━━━━━━━━━━━━━━━━━',
        value: '**Account Information**',
        inline: false
      },
      {
        name: '🎮 Gamertag',
        value: `\`${xboxProfile.gamertag || xboxGamertag}\``,
        inline: true
      },
      {
        name: '🏆 Gamerscore',
        value: `**${formattedGamerscore}**`,
        inline: true
      },
      {
        name: 'Account Tier',
        value: getTierDisplay(xboxProfile.accountTier),
        inline: true
      }
    ];

    // Add follower counts if available
    if (presenceData?.detail?.followerCount !== undefined || presenceData?.detail?.followingCount !== undefined) {
      fields.push({
        name: '👥 Followers',
        value: presenceData.detail.followerCount?.toString() || '0',
        inline: true
      });
      fields.push({
        name: '➕ Following',
        value: presenceData.detail.followingCount?.toString() || '0',
        inline: true
      });
      fields.push({
        name: '\u200b',
        value: '\u200b',
        inline: true
      });
    }

    // Add reputation and tenure section
    fields.push({
      name: '━━━━━━━━━━━━━━━━━━━━━',
      value: '**Status & Reputation**',
      inline: false
    });

    fields.push({
      name: 'Reputation',
      value: getReputationDisplay(xboxProfile.xboxOneRep),
      inline: true
    });

    // Add tenure if available
    const tenureDisplay = formatTenure(presenceData?.detail?.tenure);
    if (tenureDisplay) {
      fields.push({
        name: 'Xbox Tenure',
        value: tenureDisplay,
        inline: true
      });
    }

    // Add Game Pass status if available
    if (presenceData?.detail?.hasGamePass !== undefined) {
      fields.push({
        name: 'Game Pass',
        value: presenceData.detail.hasGamePass ? '✅ Active' : '❌ Inactive',
        inline: true
      });
    }

    // Add presence/activity if available
    if (presenceData?.presenceState || presenceData?.presenceText) {
      fields.push({
        name: '━━━━━━━━━━━━━━━━━━━━━',
        value: '**Current Activity**',
        inline: false
      });

      const statusEmojis = {
        'Online': '🟢',
        'Offline': '⚪',
        'Away': '🟡',
        'Busy': '🔴'
      };

      const statusEmoji = statusEmojis[presenceData.presenceState] || '❓';
      fields.push({
        name: `${statusEmoji} Status`,
        value: presenceData.presenceText || presenceData.presenceState || 'Offline',
        inline: false
      });
    }

    // Add Latest Achievements if found
    if (recentAchievementsDisplay) {
      fields.push({
        name: '━━━━━━━━━━━━━━━━━━━━━',
        value: '**Latest Achievements**',
        inline: false
      });
      fields.push({
        name: '\u200b',
        value: recentAchievementsDisplay,
        inline: false
      });
    }

    // Add bio if it exists
    if (xboxProfile.bio) {
      fields.push({
        name: '━━━━━━━━━━━━━━━━━━━━━',
        value: '**Bio**',
        inline: false
      });
      fields.push({
        name: '\u200b',
        value: `*"${xboxProfile.bio.substring(0, 1024)}"*`,
        inline: false
      });
    }

    console.log('Xbox fields created:', fields);

    return {
      color: embedColor,
      thumbnail: xboxProfile.profilePicture?.replace('http://', 'https://') + '&w=256&h=256', // Forced HTTPS + Resize
      author: {
        name: `${xboxProfile.gamertag || xboxGamertag} - Xbox Live`,
        iconURL: xboxProfile.profilePicture?.replace('http://', 'https://') + '&w=64&h=64', // Forced HTTPS + Resize for icon
        url: `https://www.xbox.com/en-US/play/user/${xboxProfile.gamertag || xboxGamertag}`
      },
      footer: {
        text: '🎮 Xbox Live • Powered by OpenXBL',
        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Xbox_one_logo.svg/200px-Xbox_one_logo.svg.png'
      },
      fields: fields
    };

  } catch (error) {
    console.error('Error fetching Xbox stats:', error);
    return {
      fields: [{
        name: 'Xbox Live',
        value: `⚠️ Could not fetch Xbox data: ${error.message}\n\nPlease check:\n• Gamertag is spelled correctly\n• Xbox profile is public\n• OpenXBL API key is valid`,
        inline: false
      }]
    };
  }
}

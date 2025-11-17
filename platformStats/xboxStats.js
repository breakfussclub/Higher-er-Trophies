import { getXboxProfile } from '../utils/xboxAPI.js';

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

export async function getXboxStats(xboxGamertag) {
  try {
    console.log(`Fetching Xbox stats for: ${xboxGamertag}`);
    const xboxProfile = await getXboxProfile(xboxGamertag);
    
    console.log('Xbox profile received:', xboxProfile);

    // Format gamerscore with commas
    const formattedGamerscore = xboxProfile.gamerscore?.toLocaleString() || '0';
    
    // Dynamic embed color based on account tier
    let embedColor = 0x107C10; // Xbox Green default
    if (xboxProfile.accountTier === 'Gold') embedColor = 0xFFD700; // Gold
    else if (xboxProfile.accountTier === 'Silver') embedColor = 0xC0C0C0; // Silver

    const fields = [
      { 
        name: '🎮 Gamertag', 
        value: xboxProfile.gamertag || xboxGamertag, 
        inline: true 
      },
      { 
        name: '🏆 Gamerscore', 
        value: formattedGamerscore, 
        inline: true 
      },
      { 
        name: '\u200b', 
        value: '\u200b', 
        inline: true 
      },
      { 
        name: 'Account Tier', 
        value: getTierDisplay(xboxProfile.accountTier), 
        inline: true 
      },
      { 
        name: 'Reputation', 
        value: getReputationDisplay(xboxProfile.xboxOneRep), 
        inline: true 
      },
      { 
        name: '\u200b', 
        value: '\u200b', 
        inline: true 
      }
    ];

    // Add bio if it exists
    if (xboxProfile.bio) {
      fields.push({ 
        name: '📝 Bio', 
        value: xboxProfile.bio.substring(0, 1024), 
        inline: false 
      });
    }

    console.log('Xbox fields created:', fields);

    return {
      color: embedColor,
      thumbnail: xboxProfile.profilePicture,
      author: {
        name: xboxProfile.gamertag || xboxGamertag,
        iconURL: xboxProfile.profilePicture,
        url: `https://www.xbox.com/en-US/play/user/${xboxProfile.gamertag || xboxGamertag}`
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

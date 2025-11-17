import { getXboxProfile } from '../utils/xboxAPI.js';

export async function getXboxStats(xboxGamertag) {
  try {
    console.log(`Fetching Xbox stats for: ${xboxGamertag}`);
    const xboxProfile = await getXboxProfile(xboxGamertag);
    
    console.log('Xbox profile received:', xboxProfile);

    // Format gamerscore with commas
    const formattedGamerscore = xboxProfile.gamerscore?.toLocaleString() || '0';
    
    // Determine tier emoji
    let tierEmoji = '⭐';
    if (xboxProfile.accountTier === 'Gold') tierEmoji = '🥇';
    else if (xboxProfile.accountTier === 'Silver') tierEmoji = '🥈';
    
    // Format reputation
    let repEmoji = '👍';
    if (xboxProfile.xboxOneRep === 'Good') repEmoji = '✅';
    else if (xboxProfile.xboxOneRep === 'Avoid Me') repEmoji = '⚠️';
    else if (xboxProfile.xboxOneRep === 'Needs Work') repEmoji = '⚡';

    const fields = [
      { 
        name: '🎮 Gamertag', 
        value: xboxProfile.gamertag || 'Unknown', 
        inline: true 
      },
      { 
        name: '🏆 Gamerscore', 
        value: formattedGamerscore, 
        inline: true 
      },
      { 
        name: `${tierEmoji} Account Tier`, 
        value: xboxProfile.accountTier || 'Unknown', 
        inline: true 
      },
      { 
        name: `${repEmoji} Reputation`, 
        value: xboxProfile.xboxOneRep || 'Unknown', 
        inline: true 
      }
    ];

    // Add optional fields if they exist
    if (xboxProfile.realName) {
      fields.push({ 
        name: '👤 Real Name', 
        value: xboxProfile.realName, 
        inline: true 
      });
    }
    
    if (xboxProfile.location) {
      fields.push({ 
        name: '📍 Location', 
        value: xboxProfile.location, 
        inline: true 
      });
    }
    
    if (xboxProfile.bio) {
      fields.push({ 
        name: '📝 Bio', 
        value: xboxProfile.bio.substring(0, 1024), // Discord field limit
        inline: false 
      });
    }

    console.log('Xbox fields created:', fields);
    return fields;

  } catch (error) {
    console.error('Error fetching Xbox stats:', error);
    return [{ 
      name: 'Xbox Live', 
      value: `⚠️ Could not fetch Xbox data: ${error.message}\n\nPlease check:\n• Gamertag is spelled correctly\n• Xbox profile is public\n• OpenXBL API key is valid`, 
      inline: false 
    }];
  }
}
```

## Key Changes:

1. **Added extensive logging** to see exactly what data we're getting from the API
2. **Better error messages** that show what went wrong
3. **Formatted gamerscore** with commas for readability
4. **Added emojis** to make it more visually appealing
5. **Optional fields** for real name, location, and bio (if available)
6. **Better null/undefined handling** to prevent crashes

## Debugging Steps:

After you deploy this, try running `/stats` and check your Railway logs. You should see:
```
Fetching Xbox stats for: [gamertag]
Searching for Xbox gamertag: [gamertag]
Found XUID: [xuid] for gamertag: [gamertag]
Fetching Xbox account for XUID: [xuid]
OpenXBL API response: {...full JSON response...}
Xbox profile data: {...}
Xbox profile received: {...}
Xbox fields created: [...]

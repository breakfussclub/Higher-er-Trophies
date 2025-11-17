import {
  getSteamProfile,
  getSteamGames,
  getSteamLevel,
  getSteamBadges,
  getRecentlyPlayedGames,
  getPlayerAchievements,
  getAchievementSchema
} from '../utils/steamAPI.js';

// Helper: Build Steam game icon URL
function getGameIcon(appid, img_icon_url) {
  return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${img_icon_url}.jpg`;
}

export async function getSteamStats(steamId) {
  try {
    const steamProfile = await getSteamProfile(steamId);
    const steamGames = await getSteamGames(steamId);
    const steamLevel = await getSteamLevel(steamId).catch(() => null);
    const badgesData = await getSteamBadges(steamId).catch(() => null);
    const recentGames = await getRecentlyPlayedGames(steamId).catch(() => null);

    // Most played game
    const mostPlayedGame = steamGames.games?.sort((a, b) => b.playtime_forever - a.playtime_forever)[0];

    // Game icon for most played
    const mostPlayedIcon = mostPlayedGame
      ? getGameIcon(mostPlayedGame.appid, mostPlayedGame.img_icon_url)
      : null;

    // Get latest achievements for most played game
    let achievements = [];
    let achievementDisplay = '';
    if (mostPlayedGame) {
      const achProgress = await getPlayerAchievements(steamId, mostPlayedGame.appid).catch(() => null);
      const achSchema = await getAchievementSchema(mostPlayedGame.appid).catch(() => null);

      if (achProgress && achSchema?.availableGameStats?.achievements) {
        achievements = achProgress.achievements
          .filter(a => a.achieved)
          .slice(-3)
          .map(a => {
            const fullInfo = achSchema.availableGameStats.achievements.find(s => s.name === a.apiname);
            return fullInfo
              ? `**${fullInfo.displayName}**: ${fullInfo.description}`
              : a.apiname;
          });
        achievementDisplay = achievements.length
          ? achievements.join('\n')
          : 'No recent achievements';
      }
    }

    // Format recent game activity
    let recentActivityDisplay = '';
    if (recentGames?.games?.length) {
      recentActivityDisplay = recentGames.games
        .map(g => {
          const gameIcon = getGameIcon(g.appid, g.img_icon_url);
          const time = Math.floor(g.playtime_2weeks / 60);
          return `![icon](${gameIcon}) **${g.name}** — ${time} hrs (2w)`;
        })
        .join('\n');
    }

    // Compose fields
    const embedFields = [
      { name: 'Steam Level', value: `🎚️ ${steamLevel?.player_level ?? 'N/A'}`, inline: true },
      { name: 'Games Owned', value: `🎮 ${steamGames.game_count ?? 'N/A'}`, inline: true },
      { name: 'Playtime', value: `⏱️ ${Math.floor((steamGames.games?.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) || 0)/60)} hrs`, inline: true },
      { name: 'Badges', value: `🏅 ${badgesData?.badges?.length ?? 'N/A'}`, inline: true },
      { name: 'Most Played Game', value: mostPlayedGame ? `[${mostPlayedGame.name}](${steamProfile.profileurl}/stats/${mostPlayedGame.appid}) — ${Math.floor(mostPlayedGame.playtime_forever/60)} hrs` : 'N/A', inline: false },
      ...(recentActivityDisplay ? [{ name: 'Recent Activity', value: recentActivityDisplay, inline: false }] : []),
      { name: 'Latest Achievements', value: achievementDisplay, inline: false },
      { name: 'Status', value: getOnlineStatus(steamProfile.personastate), inline: true }
    ];

    return {
      thumbnail: steamProfile.avatarfull,
      author: {
        name: steamProfile.personaname,
        iconURL: steamProfile.avatarfull,
        url: steamProfile.profileurl
      },
      fields: embedFields
    };

  } catch (error) {
    console.error('Error fetching Steam stats:', error);
    return {
      fields: [{ name: 'Steam', value: '⚠️ Could not fetch Steam data', inline: false }]
    };
  }
}

function getOnlineStatus(state) {
  const statuses = {
    0: 'Offline',
    1: 'Online',
    2: 'Busy',
    3: 'Away',
    4: 'Snooze',
    5: 'Looking to Trade',
    6: 'Looking to Play'
  };
  return statuses[state] || 'Unknown';
}

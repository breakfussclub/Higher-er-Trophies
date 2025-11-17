import { getSteamProfile, getSteamGames, getSteamLevel, getSteamBadges, getRecentlyPlayedGames, getPlayerAchievements } from '../utils/steamAPI.js';

export async function getSteamStats(steamId) {
  try {
    const steamProfile = await getSteamProfile(steamId);
    const steamGames = await getSteamGames(steamId);
    const steamLevel = await getSteamLevel(steamId).catch(() => null);
    const badgesData = await getSteamBadges(steamId).catch(() => null);
    const recentGames = await getRecentlyPlayedGames(steamId).catch(() => null);

    const totalPlaytime = steamGames.games?.reduce((sum, game) => sum + (game.playtime_forever || 0), 0) || 0;
    const hours = Math.floor(totalPlaytime / 60);

    // Pick the most played game to fetch achievements
    const topGame = steamGames.games?.[0];
    let achievements = null;
    if (topGame) {
      achievements = await getPlayerAchievements(steamId, topGame.appid).catch(() => null);
    }

    const embedFields = [
      { name: 'SteamID64', value: steamProfile.steamid || 'N/A', inline: true },
      { name: 'Steam Level', value: steamLevel?.player_level?.toString() || 'N/A', inline: true },
      { name: 'Games Owned', value: steamGames.game_count?.toString() || 'N/A', inline: true },
      { name: 'Total Playtime (hrs)', value: hours.toLocaleString(), inline: true },
      { name: 'Status', value: getOnlineStatus(steamProfile.personastate), inline: true },
    ];

    if (steamProfile.gameextrainfo) {
      embedFields.push({ name: 'Currently Playing', value: steamProfile.gameextrainfo, inline: false });
    }

    if (badgesData) {
      embedFields.push({ name: 'Badge Count', value: badgesData.badges?.length.toString() || 'N/A', inline: true });
    }

    if (recentGames && recentGames.total_count > 0) {
      const recentGame = recentGames.games[0];
      embedFields.push({
        name: 'Recent Activity',
        value: `${recentGame.name} — ${Math.floor(recentGame.playtime_2weeks / 60)} hours last 2 weeks`,
        inline: false
      });
    }

    if (achievements && achievements.achievements) {
      const recentAchievements = achievements.achievements
        .filter(a => a.achieved)
        .slice(-3)
        .map(a => a.apiname)
        .join('\n');

      if (recentAchievements) {
        embedFields.push({
          name: `Latest Achievements (${topGame?.name || 'Game'})`,
          value: recentAchievements,
          inline: false
        });
      }
    }

    return {
      thumbnail: steamProfile.avatarfull,
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


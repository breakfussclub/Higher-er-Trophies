import { getSteamProfile, getSteamGames, getSteamLevel } from '../utils/steamAPI.js';

export async function getSteamStats(steamId) {
  try {
    const steamProfile = await getSteamProfile(steamId);
    const steamGames = await getSteamGames(steamId);
    const steamLevel = await getSteamLevel(steamId).catch(() => null);

    const totalPlaytime = steamGames.games?.reduce((sum, game) => sum + (game.playtime_forever || 0), 0) || 0;
    const hours = Math.floor(totalPlaytime / 60);

    const fields = [
      { name: '🎮 Steam Profile', value: `[${steamProfile.personaname}](${steamProfile.profileurl})`, inline: true },
      { name: 'SteamID64', value: steamProfile.steamid || 'N/A', inline: true },
      { name: 'Steam Level', value: steamLevel?.player_level?.toString() || 'N/A', inline: true },
      { name: 'Games Owned', value: steamGames.game_count?.toString() || 'N/A', inline: true },
      { name: 'Total Playtime (hrs)', value: hours.toLocaleString(), inline: true },
      { name: 'Status', value: getOnlineStatus(steamProfile.personastate), inline: true },
    ];

    if (steamProfile.gameextrainfo) {
      fields.push({ name: 'Currently Playing', value: steamProfile.gameextrainfo, inline: false });
    }

    return fields;

  } catch (error) {
    console.error('Error fetching Steam stats:', error);
    return [{ name: 'Steam', value: '⚠️ Could not fetch Steam data', inline: false }];
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
    6: 'Looking to Play',
  };
  return statuses[state] || 'Unknown';
}

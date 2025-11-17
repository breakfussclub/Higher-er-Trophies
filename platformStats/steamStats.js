import {
  getSteamProfile,
  getSteamGames,
  getSteamLevel,
  getSteamBadges,
  getRecentlyPlayedGames,
  getPlayerAchievements,
  getAchievementSchema
} from '../utils/steamAPI.js';

function getGameIcon(appid, img_icon_url) {
  return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${img_icon_url}.jpg`;
}

function getBadgeIcon(appid, badge_image_url) {
  return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/items/${appid}/${badge_image_url}.png`;
}

function getStatusEmoji(state) {
  const statuses = {
    0: '⚪ Offline',
    1: '🟢 Online',
    2: '🔴 Busy',
    3: '🟡 Away',
    4: '🟠 Snooze',
    5: '🔵 Trading',
    6: '🟣 Looking to Play'
  };
  return statuses[state] || 'Unknown';
}

export async function getSteamStats(steamId) {
  try {
    const steamProfile = await getSteamProfile(steamId);
    const steamGames = await getSteamGames(steamId);
    const steamLevel = await getSteamLevel(steamId).catch(() => null);
    const badgesData = await getSteamBadges(steamId).catch(() => null);
    const recentGames = await getRecentlyPlayedGames(steamId).catch(() => null);

    const totalPlaytime = Math.floor((steamGames.games?.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) || 0)/60);

    // Dynamic color based on Steam Level
    let embedColor = 0x1E90FF; // Blue default
    if (steamLevel?.player_level >= 30) embedColor = 0xFFD700; // Gold
    else if (steamLevel?.player_level >= 10) embedColor = 0x32CD32; // Green

    // Most played game with game icon
    const mostPlayedGame = steamGames.games?.sort((a, b) => b.playtime_forever - a.playtime_forever)[0];
    const mostPlayedIcon = mostPlayedGame ? getGameIcon(mostPlayedGame.appid, mostPlayedGame.img_icon_url) : null;

    // Latest badge (if any)
    let latestBadgeField = null;
    if (badgesData?.badges?.length) {
      const latestBadge = badgesData.badges.sort((a, b) => b.level - a.level)[0];
      if (latestBadge?.appid && latestBadge?.icon) {
        const badgeUrl = getBadgeIcon(latestBadge.appid, latestBadge.icon);
        latestBadgeField = {
          name: '🏅 Latest Badge',
          value: `[Level ${latestBadge.level ?? ''}](${badgeUrl})`,
          inline: true
        };
      }
    }

    // Latest achievements for most played game
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

    // Recent activity (with game icons and playtime)
    let recentActivityDisplay = '';
    if (recentGames?.games?.length) {
      recentActivityDisplay = '**Recent Activity**\n' + recentGames.games
        .map(g => {
          const gameIcon = getGameIcon(g.appid, g.img_icon_url);
          const time = Math.floor(g.playtime_2weeks / 60);
          return `[${g.name}](https://store.steampowered.com/app/${g.appid}/) — ${time} hrs (2w)`;
        })
        .join('\n');
    }

    const embedFields = [
      { name: 'Steam Level', value: `🎚️ ${steamLevel?.player_level ?? 'N/A'}`, inline: true },
      { name: 'Games Owned', value: `🎮 ${steamGames.game_count ?? 'N/A'}`, inline: true },
      { name: 'Playtime', value: `🕒 ${totalPlaytime} hrs`, inline: true },
      { name: 'Badges', value: `🏅 ${badgesData?.badges?.length ?? 'N/A'}`, inline: true },
      ...(latestBadgeField ? [latestBadgeField] : []),
      mostPlayedGame && {
        name: '**Most Played Game**',
        value: `[${mostPlayedGame.name}](https://store.steampowered.com/app/${mostPlayedGame.appid}/) — ${Math.floor(mostPlayedGame.playtime_forever / 60)} hrs`,
        inline: false
      },
      recentActivityDisplay && {
        name: 'Recent Activity',
        value: recentActivityDisplay,
        inline: false
      },
      {
        name: '**Latest Achievements**',
        value: achievementDisplay,
        inline: false
      },
      {
        name: 'Status',
        value: getStatusEmoji(steamProfile.personastate),
        inline: true
      }
    ].filter(Boolean);

    return {
      thumbnail: steamProfile.avatarfull,
      author: {
        name: steamProfile.personaname,
        iconURL: steamProfile.avatarfull,
        url: steamProfile.profileurl
      },
      color: embedColor,
      fields: embedFields
    };

  } catch (error) {
    console.error('Error fetching Steam stats:', error);
    return {
      fields: [{ name: 'Steam', value: '⚠️ Could not fetch Steam data', inline: false }]
    };
  }
}

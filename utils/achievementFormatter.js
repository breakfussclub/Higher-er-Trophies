import { EmbedBuilder } from 'discord.js';

function getTrophyEmoji(type) {
  const emojis = {
    platinum: '🏆',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉'
  };
  return emojis[type] || '🏅';
}

/**
 * Format achievement digest into Discord embeds
 * @param {Object} newAchievements - New achievements by user
 * @param {Client} client - Discord client
 * @returns {Array<EmbedBuilder>} Array of embeds
 */
export async function formatAchievementDigest(newAchievements, client) {
  const embeds = [];
  const now = new Date();

  // Create main embed
  const mainEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🏆 Achievement & Trophy Digest')
    .setDescription(`New achievements and trophies earned since last sync`)
    .setTimestamp(now);

  let hasContent = false;

  // Process each user
  for (const [userId, achievements] of Object.entries(newAchievements)) {
    const user = await client.users.fetch(userId).catch(() => null);
    const username = user ? user.username : `User ${userId}`;

    // Steam Achievements
    if (achievements.steam && achievements.steam.length > 0) {
      hasContent = true;

      // Set thumbnail to the most recent game's icon (if not already set by PSN)
      if (!mainEmbed.data.thumbnail && achievements.steam[0].gameId) {
        // Steam game icons are available at: https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg
        const steamIconUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${achievements.steam[0].gameId}/header.jpg`;
        mainEmbed.setThumbnail(steamIconUrl);
      }

      const steamField = achievements.steam
        .sort((a, b) => (b.unlockTime || 0) - (a.unlockTime || 0))
        .slice(0, 5) // Limit to 5 per user to avoid embed size limits
        .map(a => {
          const time = a.unlockTime ? `<t:${a.unlockTime}:R>` : '';
          return `**${a.name}**\n*${a.gameName}*\n${a.description || 'No description'} ${time}`;
        })
        .join('\n\n');

      mainEmbed.addFields({
        name: `🎮 ${username} - Steam (${achievements.steam.length} new)`,
        value: steamField.substring(0, 1024), // Discord field value limit
        inline: false
      });
    }

    // PSN Trophies
    if (achievements.psn && achievements.psn.length > 0) {
      hasContent = true;

      // Set thumbnail to the most recent game's icon
      if (achievements.psn[0].gameIcon) {
        mainEmbed.setThumbnail(achievements.psn[0].gameIcon);
      }

      // Group trophies by game
      const trophiesByGame = {};
      achievements.psn
        .sort((a, b) => (b.unlockTime || 0) - (a.unlockTime || 0))
        .forEach(t => {
          if (!trophiesByGame[t.gameName]) {
            trophiesByGame[t.gameName] = [];
          }
          trophiesByGame[t.gameName].push(t);
        });

      // Build field value
      let psnField = '';
      for (const [gameName, trophies] of Object.entries(trophiesByGame)) {
        psnField += `**${gameName}**\n`;

        const trophyLines = trophies.map(t => {
          const time = t.unlockTime ? `<t:${Math.floor(t.unlockTime)}:R>` : '';
          const emoji = getTrophyEmoji(t.type) || '🏆';
          return `${emoji} **${t.name}**\n${t.description || 'No description'} ${time}`;
        });

        psnField += trophyLines.join('\n\n') + '\n\n';
      }

      mainEmbed.addFields({
        name: `🎮 ${username} - PlayStation (${achievements.psn.length} new)`,
        value: psnField.substring(0, 1024),
        inline: false
      });
    }

    // Xbox Achievements
    if (achievements.xbox && achievements.xbox.length > 0) {
      hasContent = true;

      // Set thumbnail to the most recent game's icon
      if (!mainEmbed.data.thumbnail && achievements.xbox[0].gameIcon) {
        mainEmbed.setThumbnail(achievements.xbox[0].gameIcon);
      }

      const xboxField = achievements.xbox
        .sort((a, b) => (b.unlockTime || 0) - (a.unlockTime || 0))
        .slice(0, 5)
        .map(a => {
          const time = a.unlockTime ? `<t:${a.unlockTime}:R>` : '';
          const gamerscore = a.gamerscore ? `**${a.gamerscore}G** • ` : '';
          return `${gamerscore}**${a.name}**\n*${a.gameName}*\n${a.description || 'No description'} ${time}`;
        })
        .join('\n\n');

      mainEmbed.addFields({
        name: `🎮 ${username} - Xbox (${achievements.xbox.length} new)`,
        value: xboxField.substring(0, 1024),
        inline: false
      });
    }
  }

  if (hasContent) {
    embeds.push(mainEmbed);
  }

  return embeds;
}

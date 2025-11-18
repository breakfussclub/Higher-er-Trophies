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
      
      const steamField = achievements.steam
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
    if (achievements.psn) {
      hasContent = true;
      
      const trophies = [];
      if (achievements.psn.platinum > 0) trophies.push(`${getTrophyEmoji('platinum')} ${achievements.psn.platinum} Platinum`);
      if (achievements.psn.gold > 0) trophies.push(`${getTrophyEmoji('gold')} ${achievements.psn.gold} Gold`);
      if (achievements.psn.silver > 0) trophies.push(`${getTrophyEmoji('silver')} ${achievements.psn.silver} Silver`);
      if (achievements.psn.bronze > 0) trophies.push(`${getTrophyEmoji('bronze')} ${achievements.psn.bronze} Bronze`);

      mainEmbed.addFields({
        name: `🎮 ${username} - PlayStation (${achievements.psn.total} new)`,
        value: trophies.join(' • '),
        inline: false
      });
    }

    // Xbox Achievements
    if (achievements.xbox && achievements.xbox.length > 0) {
      hasContent = true;
      
      const xboxField = achievements.xbox
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

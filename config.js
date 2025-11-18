import { config } from 'dotenv';
config();

export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    achievementChannelId: process.env.ACHIEVEMENT_CHANNEL_ID // New: Channel for achievement announcements
  },
  steam: {
    apiKey: process.env.STEAM_API_KEY
  },
  psn: {
    npsso: process.env.PSN_NPSSO
  },
  xbox: {
    apiKey: process.env.OPENXBL_API_KEY
  },
  scheduler: {
    // Cron expression for scheduling (default: twice daily at 12pm and 8pm)
    // Format: "minute hour * * *" or standard cron
    cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 12,20 * * *',
    // Alternatively, if you prefer interval in hours:
    syncIntervalHours: process.env.SYNC_INTERVAL_HOURS ? parseInt(process.env.SYNC_INTERVAL_HOURS) : null
  }
};

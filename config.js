import { config } from 'dotenv';
config();

export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID
  },
  steam: {
    apiKey: process.env.STEAM_API_KEY
  },
  psn: {
    npsso: process.env.PSN_NPSSO
  },
  xbox: {
    apiKey: process.env.OPENXBL_API_KEY
  }
};

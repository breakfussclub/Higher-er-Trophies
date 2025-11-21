import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import config from './config.js';
import logger from './utils/logger.js';
import { checkNewAchievements } from './jobs/syncAchievements.js';
import { formatAchievementDigest } from './utils/achievementFormatter.js';
import { postDailyDigest } from './jobs/dailyDigest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Collection to store commands
client.commands = new Collection();

// Load commands
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);

  if ('data' in command.default && 'execute' in command.default) {
    client.commands.set(command.default.data.name, command.default);
    commands.push(command.default.data.toJSON());
    logger.info(`Loaded command: ${command.default.data.name}`);
  } else {
    logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands }
    );

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
})();

// Event: Bot ready
client.once('ready', () => {
  logger.info(`${client.user.tag} is online and ready!`);
  logger.info(`Serving ${client.guilds.cache.size} server(s)`);

  // Initialize Scheduler with node-cron
  if (config.discord.achievementChannelId) {
    const schedule = config.scheduler.cronSchedule || '0 * * * *'; // Default hourly
    logger.info(`📅 Scheduler initialized: ${schedule}`);

    cron.schedule(schedule, async () => {
      logger.info('🔄 Running scheduled achievement sync...');
      try {
        const newAchievements = await checkNewAchievements();

        if (Object.keys(newAchievements).length > 0) {
          const channel = client.channels.cache.get(config.discord.achievementChannelId);
          if (channel) {
            const embeds = await formatAchievementDigest(newAchievements, client);
            for (const embed of embeds) {
              await channel.send({ embeds: [embed] });
            }
            logger.info(`✅ Posted achievements for ${Object.keys(newAchievements).length} user(s).`);
          } else {
            logger.warn('⚠️ Achievement channel not found.');
          }
        } else {
          logger.info('✅ No new achievements found.');
        }
      } catch (error) {
        logger.error('❌ Error in scheduled sync:', error);
      }
    });
    // Schedule Daily Digest (Every day at 9 AM)
    cron.schedule('0 9 * * *', async () => {
      await postDailyDigest(client);
    });

  } else {
    logger.warn('⚠️ ACHIEVEMENT_CHANNEL_ID not set. Scheduled syncs disabled.');
  }
});

// Event: Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}:`, error);

    const errorMessage = { content: 'There was an error executing this command!', ephemeral: true };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Login
client.login(config.discord.token);

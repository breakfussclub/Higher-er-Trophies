import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { initializeScheduler } from './utils/scheduler.js';

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
    console.log(`✅ Loaded command: ${command.default.data.name}`);
  } else {
    console.log(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands }
    );

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();

// Event: Bot ready
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} is online and ready!`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  
  // Initialize achievement scheduler
  initializeScheduler(client);
});

// Event: Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);

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
```

---

# Updated File Tree
```
higher-er-trophies-bot/
├── commands/
│   ├── link.js
│   ├── stats.js
│   ├── unlink.js
│   └── sync.js              ← NEW
├── data/
│   ├── users.json
│   └── achievements.json     ← NEW (auto-created)
├── platformStats/
│   ├── psnStats.js
│   ├── steamStats.js
│   └── xboxStats.js
├── utils/
│   ├── psnAPI.js
│   ├── steamAPI.js
│   ├── userData.js
│   ├── xboxAPI.js
│   ├── achievementTracker.js    ← NEW
│   ├── achievementFormatter.js  ← NEW
│   └── scheduler.js             ← NEW
├── .env
├── .gitignore
├── config.js                ← UPDATED
├── index.js                 ← UPDATED
├── package.json
└── readme.md

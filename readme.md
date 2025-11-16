Gaming Tracker Discord Bot
A Discord bot that tracks PSN, Steam, and Xbox Live data for your server members.

Features
🎮 Link PSN, Steam, and Xbox Live accounts to Discord profiles

📊 View detailed gaming statistics across all platforms

🏆 Track achievements, trophies, and gamerscore

⏱️ Monitor playtime and recently played games

📈 Compare stats between server members (coming soon)

🏅 Server leaderboards (coming soon)

Setup Instructions
Prerequisites
Node.js 18.x or higher

A Discord Bot Token

Steam Web API Key

PSN NPSSO Token

Xbox Live API credentials (Azure AD)

1. Clone or Download the Project
Download all the project files to your local machine.

2. Install Dependencies
bash
npm install
3. Get Your API Keys
Discord Bot Token
Go to Discord Developer Portal

Click "New Application" and give it a name

Go to the "Bot" tab and click "Add Bot"

Under "Token", click "Copy" to get your bot token

Under "Privileged Gateway Intents", enable:

Server Members Intent

Message Content Intent

Go to "OAuth2" > "URL Generator"

Select scopes: bot and applications.commands

Select permissions: Send Messages, Embed Links, Read Messages/View Channels

Copy the generated URL and use it to invite the bot to your server

Steam API Key
Go to https://steamcommunity.com/dev/apikey

Log in with your Steam account

Enter any domain name (e.g., localhost or your website)

Click "Register"

Copy your Steam Web API Key

PSN NPSSO Token
Visit https://www.playstation.com and sign in

Once logged in, visit https://ca.account.sony.com/api/v1/ssocookie

Copy the 64-character NPSSO token from the response

Note: This token expires after ~2 months and needs to be refreshed

Xbox Live API (Azure AD)
Go to https://portal.azure.com

Navigate to "Azure Active Directory" > "App registrations"

Click "New registration"

Name your app and click "Register"

Copy the "Application (client) ID" - this is your XBOX_CLIENT_ID

Go to "Certificates & secrets" > "New client secret"

Create a secret and copy the value - this is your XBOX_CLIENT_SECRET

Note: Xbox API setup is complex; you may need additional configuration

4. Configure Environment Variables
Rename .env.example to .env

Fill in all the required values:

text
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_server_id

STEAM_API_KEY=your_steam_api_key

PSN_NPSSO=your_psn_npsso_token

XBOX_CLIENT_ID=your_xbox_client_id
XBOX_CLIENT_SECRET=your_xbox_client_secret
5. Run the Bot
bash
npm start
For development with auto-restart:

bash
npm run dev
Commands
/link <platform> <username>
Link your gaming account to your Discord profile.

Example:

/link platform:Steam username:76561198123456789

/link platform:PSN username:YourPSNID

/link platform:Xbox username:YourGamertag

/stats [user] [platform]
View gaming statistics for yourself or another user.

Examples:

/stats - View all your stats

/stats user:@Friend - View a friend's stats

/stats platform:Steam - View only Steam stats

/stats user:@Friend platform:PSN - View a friend's PSN stats

/unlink <platform>
Unlink a gaming account from your Discord profile.

Example:

/unlink platform:Steam

Project Structure
text
gaming-tracker-bot/
├── commands/           # Slash command files
│   ├── link.js
│   ├── stats.js
│   └── unlink.js
├── utils/             # API utilities
│   ├── steamAPI.js
│   ├── psnAPI.js
│   ├── xboxAPI.js
│   └── userData.js
├── data/              # User data storage
│   └── users.json
├── index.js           # Main bot file
├── config.js          # Configuration
├── package.json
└── .env              # Environment variables
Deployment
Railway
Sign up at https://railway.app

Create a new project

Connect your GitHub repository

Add environment variables in the Railway dashboard

Deploy

Render
Sign up at https://render.com

Create a new Web Service

Connect your GitHub repository

Add environment variables

Deploy

Fly.io
Install Fly CLI: brew install flyctl (macOS)

Sign up: fly auth signup

Launch: fly launch

Set secrets: fly secrets set DISCORD_TOKEN=xxx STEAM_API_KEY=xxx ...

Deploy: fly deploy

Troubleshooting
PSN API Issues
Make sure your NPSSO token is valid and not expired

PSN profiles must be public to fetch some data

NPSSO tokens expire after ~2 months

Steam API Issues
Verify your Steam API key is correct

Steam profiles must be public

For custom URLs, the bot will automatically convert to SteamID64

Xbox API Issues
Xbox Live API is the most complex to set up

May require additional Azure AD permissions

Some endpoints may need Xbox Live Developer account

Contributing
Feel free to submit issues or pull requests!

License
MIT License

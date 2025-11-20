import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../database/db.js';
import { initializeDatabase } from '../database/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const usersFile = path.join(projectRoot, 'data', 'users.json');
const achievementsFile = path.join(projectRoot, 'data', 'achievements.json');

async function migrate() {
    console.log('🚀 Starting migration from JSON to PostgreSQL...');

    // 1. Initialize Schema
    await initializeDatabase();

    // 2. Migrate Users & Linked Accounts
    if (fs.existsSync(usersFile)) {
        console.log('📦 Migrating users...');
        const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

        for (const [discordId, platforms] of Object.entries(usersData)) {
            // Create User
            await query(
                `INSERT INTO users (discord_id) VALUES ($1) ON CONFLICT (discord_id) DO NOTHING`,
                [discordId]
            );

            // Create Linked Accounts
            for (const [platform, accountId] of Object.entries(platforms)) {
                // Skip non-platform keys if any (like xboxUid which was stored at top level in some versions?)
                // In the latest code, xboxUid is stored inside the user object but not as a platform key?
                // Let's check the structure of users.json based on previous code.
                // Structure was: { "discordId": { "steam": "id", "psn": "id", "xbox": "id", "xboxUid": "uid" } }

                if (['steam', 'psn', 'xbox'].includes(platform)) {
                    let extraData = {};

                    // Extract extra data
                    if (platform === 'xbox' && platforms.xboxUid) {
                        extraData.xuid = platforms.xboxUid;
                    }
                    if (platform === 'psn' && platforms.psnAccountId) {
                        extraData.accountId = platforms.psnAccountId;
                    }
                    if (platform === 'steam' && platforms.steamId64) {
                        extraData.steamId64 = platforms.steamId64;
                    }

                    await query(
                        `INSERT INTO linked_accounts (discord_id, platform, account_id, extra_data)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (discord_id, platform) DO UPDATE 
             SET account_id = EXCLUDED.account_id, extra_data = EXCLUDED.extra_data`,
                        [discordId, platform, accountId, JSON.stringify(extraData)]
                    );
                    console.log(`   - Linked ${platform} for ${discordId}`);
                }
            }
        }
    }

    // 3. Migrate Achievements
    if (fs.existsSync(achievementsFile)) {
        console.log('🏆 Migrating achievements...');
        const achievementData = JSON.parse(fs.readFileSync(achievementsFile, 'utf8'));

        // Structure: { "users": { "discordId": { "steam": [ {id, name...} ], "psn": [], "xbox": [] } } }
        if (achievementData.users) {
            for (const [discordId, platforms] of Object.entries(achievementData.users)) {
                for (const [platform, achievements] of Object.entries(platforms)) {
                    if (!Array.isArray(achievements)) continue;

                    for (const achievement of achievements) {
                        // achievement.id is usually "gameId_achievementId"
                        // We need to parse it or just store it.
                        // The schema expects game_id and achievement_id separately.
                        // Let's try to split it if possible, or just store the whole ID as achievement_id and game_id from the object.

                        const gameId = achievement.gameId || 'unknown';
                        const achievementId = achievement.id || 'unknown';
                        const unlockTime = achievement.unlockTime ? new Date(achievement.unlockTime * 1000) : null;

                        await query(
                            `INSERT INTO achievements (discord_id, platform, game_id, achievement_id, unlocked_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (discord_id, platform, game_id, achievement_id) DO NOTHING`,
                            [discordId, platform, gameId, achievementId, unlockTime]
                        );
                    }
                    console.log(`   - Migrated ${achievements.length} ${platform} achievements for ${discordId}`);
                }
            }
        }
    }

    console.log('✅ Migration complete!');
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});

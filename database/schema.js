import { query } from './db.js';

export async function initializeDatabase() {
  console.log('🔄 Initializing database schema...');

  try {
    // Users table (Discord users)
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        discord_id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Linked Accounts table (One user can have multiple platform accounts)
    // Actually, to keep it simple and match current logic, we can just have columns in users table?
    // No, let's do it right.
    await query(`
      CREATE TABLE IF NOT EXISTS linked_accounts (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(255) REFERENCES users(discord_id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL, -- 'steam', 'psn', 'xbox'
        account_id VARCHAR(255) NOT NULL, -- The ID used for API lookups
        username VARCHAR(255), -- Display name
        extra_data JSONB DEFAULT '{}', -- Store things like XUID, SteamID64, etc.
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(discord_id, platform)
      );
    `);

    // Achievements table (Track what we've already seen/announced)
    await query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(255) REFERENCES users(discord_id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        game_id VARCHAR(255) NOT NULL,
        achievement_id VARCHAR(255) NOT NULL,
        achievement_name VARCHAR(255),
        description TEXT,
        game_name VARCHAR(255),
        icon_url TEXT,
        unlocked_at TIMESTAMP WITH TIME ZONE, -- When it was unlocked in game
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- When we found it
        UNIQUE(discord_id, platform, game_id, achievement_id)
      );
    `);

    // Ensure columns exist if table already existed (Migration)
    await query(`
            ALTER TABLE achievements
            ADD COLUMN IF NOT EXISTS achievement_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS game_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS icon_url TEXT;
        `);

    console.log('✅ Database schema initialized successfully.');
  } catch (error) {
    console.error('❌ Error initializing database schema:', error);
    throw error;
  }
}

// Run if called directly
if (process.argv[1] === import.meta.url.substring(7)) { // basic check for "is main module"
  initializeDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

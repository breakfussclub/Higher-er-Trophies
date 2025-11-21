import 'dotenv/config';
import { query } from '../database/db.js';

async function migrate() {
    console.log('🔄 Starting migration: Add achievement details columns...');

    try {
        await query(`
            ALTER TABLE achievements
            ADD COLUMN IF NOT EXISTS achievement_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS game_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS icon_url TEXT;
        `);

        console.log('✅ Migration successful: Columns added.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();

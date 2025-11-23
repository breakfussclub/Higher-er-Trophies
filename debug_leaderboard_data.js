import { query } from './database/db.js';

async function debugLeaderboardData() {
    try {
        const { rows } = await query(`
            SELECT * FROM linked_accounts LIMIT 5
        `);
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error(error);
    }
}

debugLeaderboardData();

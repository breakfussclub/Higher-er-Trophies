import 'dotenv/config';
import { getXboxStats } from '../platformStats/xboxStats.js';
import { getPSNStats } from '../platformStats/psnStats.js';

async function debugStats() {
    console.log('🔍 Starting Stats Debug...');

    const username = 'Breakfuss';

    try {
        console.log(`\n--- Testing Xbox Stats for ${username} ---`);
        const xboxStats = await getXboxStats(username);
        console.log('Xbox Stats Result:', JSON.stringify(xboxStats, null, 2));
    } catch (e) {
        console.error('Xbox Test Failed:', e);
    }

    try {
        console.log(`\n--- Testing PSN Stats for ${username} ---`);
        const psnStats = await getPSNStats(username);
        console.log('PSN Stats Result:', JSON.stringify(psnStats, null, 2));
    } catch (e) {
        console.error('PSN Test Failed:', e);
    }

    process.exit(0);
}

debugStats().catch(console.error);

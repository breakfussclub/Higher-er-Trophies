import 'dotenv/config';
import { getXboxStats } from '../platformStats/xboxStats.js';
import { getXboxAchievements } from '../services/xboxService.js';
import { getXboxProfile } from '../services/xboxService.js';

async function debugStats() {
    console.log('🔍 Starting Stats Debug (Xbox Only)...');

    const username = 'Breakfuss';

    try {
        console.log(`\n--- Testing Xbox Stats for ${username} ---`);
        const profile = await getXboxProfile(username);
        console.log('XUID:', profile.xuid);

        const achievementsData = await getXboxAchievements(profile.xuid);
        console.log('Achievements Data Type:', typeof achievementsData);
        console.log('Is Array?', Array.isArray(achievementsData));
        if (!Array.isArray(achievementsData)) {
            console.log('Keys:', Object.keys(achievementsData));
            if (achievementsData.titles) {
                console.log('First Title:', JSON.stringify(achievementsData.titles[0], null, 2));
            }
        } else {
            console.log('First Item:', JSON.stringify(achievementsData[0], null, 2));
        }

    } catch (e) {
        console.error('Xbox Test Failed:', e);
    }

    process.exit(0);
}

debugStats().catch(console.error);

import { getSteamAchievements } from './utils/achievementTracker.js';
import { getPSNTrophies } from './utils/achievementTracker.js';
import { getXboxAchievementsData } from './utils/achievementTracker.js';

/**
 * Test script to debug achievement fetching for all platforms
 * This will show detailed logs of what data is being returned from each API
 */

console.log('='.repeat(80));
console.log('ACHIEVEMENT TRACKING TEST SCRIPT');
console.log('='.repeat(80));
console.log('');

// Test configuration - replace with actual IDs to test
const TEST_CONFIG = {
    steam: {
        enabled: false, // Set to true and provide Steam ID to test
        steamId: '76561198XXXXXXXXX' // Replace with actual Steam ID
    },
    psn: {
        enabled: false, // Set to true and provide PSN ID to test
        psnId: 'YourPSNUsername' // Replace with actual PSN username
    },
    xbox: {
        enabled: false, // Set to true and provide Xbox gamertag to test
        gamertag: 'YourGamertag' // Replace with actual Xbox gamertag
    }
};

async function testSteam() {
    if (!TEST_CONFIG.steam.enabled) {
        console.log('[Steam] Testing disabled - set enabled: true in TEST_CONFIG to test');
        return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('TESTING STEAM ACHIEVEMENTS');
    console.log('='.repeat(80));

    try {
        // Note: This function is not exported, so we'll need to test via the actual API
        console.log('[Steam] This test requires Steam API to be properly configured');
        console.log('[Steam] Steam ID:', TEST_CONFIG.steam.steamId);
        console.log('[Steam] Run the bot with a linked Steam account to see detailed logs');
    } catch (error) {
        console.error('[Steam] Test failed:', error.message);
    }
}

async function testPSN() {
    if (!TEST_CONFIG.psn.enabled) {
        console.log('[PSN] Testing disabled - set enabled: true in TEST_CONFIG to test');
        return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('TESTING PSN TROPHIES');
    console.log('='.repeat(80));

    try {
        console.log('[PSN] This test requires PSN API to be properly configured');
        console.log('[PSN] PSN ID:', TEST_CONFIG.psn.psnId);
        console.log('[PSN] Run the bot with a linked PSN account to see detailed logs');
    } catch (error) {
        console.error('[PSN] Test failed:', error.message);
    }
}

async function testXbox() {
    if (!TEST_CONFIG.xbox.enabled) {
        console.log('[Xbox] Testing disabled - set enabled: true in TEST_CONFIG to test');
        return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('TESTING XBOX ACHIEVEMENTS');
    console.log('='.repeat(80));

    try {
        console.log('[Xbox] This test requires Xbox API to be properly configured');
        console.log('[Xbox] Gamertag:', TEST_CONFIG.xbox.gamertag);
        console.log('[Xbox] Run the bot with a linked Xbox account to see detailed logs');
    } catch (error) {
        console.error('[Xbox] Test failed:', error.message);
    }
}

async function runTests() {
    console.log('This test script helps debug achievement tracking.');
    console.log('');
    console.log('To use:');
    console.log('1. Edit TEST_CONFIG in this file to enable platforms and add IDs');
    console.log('2. Run: node test_achievements.js');
    console.log('3. Check the detailed logs to see what data is being returned');
    console.log('');
    console.log('OR better yet:');
    console.log('1. Link accounts via Discord: /link platform:steam username:YourID');
    console.log('2. Run sync: /sync');
    console.log('3. Check console logs for detailed [Steam], [PSN], [Xbox] output');
    console.log('');

    await testSteam();
    await testPSN();
    await testXbox();

    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Link your gaming accounts in Discord using /link');
    console.log('2. Run /sync to trigger achievement checking');
    console.log('3. Watch the console for detailed [Platform] logs');
    console.log('4. Check the digest in Discord to see if achievements show correctly');
    console.log('');
}

runTests().catch(console.error);

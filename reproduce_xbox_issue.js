
import { config } from 'dotenv';
config();
import { searchGamertag, getXboxAchievements, getTitleAchievements } from './utils/xboxAPI.js';

async function run() {
    const gamertag = 'breakfuss';
    console.log(`Debugging Xbox achievements for: ${gamertag}`);

    try {
        const searchResult = await searchGamertag(gamertag);
        const xuid = searchResult.xuid;
        console.log(`Found XUID: ${xuid}`);

        const achievements = await getXboxAchievements(xuid);
        if (!achievements?.titles) {
            console.log('No titles found.');
            return;
        }

        console.log(`Found ${achievements.titles.length} titles.`);

        // Sort by last played
        const sortedTitles = achievements.titles.sort((a, b) => {
            const timeA = new Date(a.lastUnlock || a.lastPlayed || 0).getTime();
            const timeB = new Date(b.lastUnlock || b.lastPlayed || 0).getTime();
            return timeB - timeA;
        });

        // Check top 3 titles
        for (const title of sortedTitles.slice(0, 3)) {
            console.log(`\nChecking title: ${title.name} (${title.titleId})`);

            const titleAchievements = await getTitleAchievements(title.titleId, xuid);

            if (!titleAchievements?.achievements) {
                console.log('No achievements found for title.');
                continue;
            }

            const unlocked = titleAchievements.achievements.filter(a =>
                a.progressState === 'Achieved' || a.progression?.achieved === true || a.achieved === true || a.timeUnlocked
            );

            console.log(`Found ${unlocked.length} unlocked achievements.`);

            if (unlocked.length > 0) {
                const a = unlocked[0];
                console.log('Sample achievement raw data:', JSON.stringify(a, null, 2));

                const unlockTime = a.timeUnlocked || a.unlockTime || a.progression?.timeUnlocked;
                console.log(`Raw unlockTime: ${unlockTime}`);

                if (unlockTime) {
                    const date = new Date(unlockTime);
                    console.log(`Parsed Date: ${date.toString()}`);
                    console.log(`Timestamp: ${date.getTime()}`);

                    const now = new Date();
                    const diff = now.getTime() - date.getTime();
                    const years = diff / (1000 * 60 * 60 * 24 * 365);
                    console.log(`Years ago: ${years}`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

run();

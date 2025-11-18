import { checkNewAchievements } from './achievementTracker.js';
import { formatAchievementDigest } from './achievementFormatter.js';
import config from '../config.js';

/**
 * Parse cron expression to determine next run time
 * Simplified parser - handles "minute hour * * *" format
 */
function parseCronSchedule(cronExpression) {
  const parts = cronExpression.split(' ');
  if (parts.length < 5) return null;

  const [minute, hour] = parts;
  
  // Handle comma-separated values (e.g., "0 12,20 * * *")
  const hours = hour.includes(',') ? hour.split(',').map(Number) : [Number(hour)];
  const minutes = Number(minute);

  return { hours, minutes };
}

/**
 * Calculate milliseconds until next scheduled run
 */
function getMillisecondsUntilNextRun(schedule) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  let nextHour = null;

  // Find next scheduled hour
  for (const hour of schedule.hours.sort((a, b) => a - b)) {
    if (hour > currentHour || (hour === currentHour && schedule.minutes > currentMinute)) {
      nextHour = hour;
      break;
    }
  }

  // If no hour found today, use first hour tomorrow
  const nextRun = new Date();
  if (nextHour === null) {
    nextRun.setDate(nextRun.getDate() + 1);
    nextHour = schedule.hours[0];
  }

  nextRun.setHours(nextHour, schedule.minutes, 0, 0);

  return nextRun.getTime() - now.getTime();
}

/**
 * Run scheduled achievement sync
 */
async function runScheduledSync(client) {
  console.log('🔄 Running scheduled achievement sync...');

  try {
    const newAchievements = await checkNewAchievements();

    if (Object.keys(newAchievements).length === 0) {
      console.log('✅ Scheduled sync complete. No new achievements found.');
      return;
    }

    // Get achievement channel
    const achievementChannel = client.channels.cache.get(config.discord.achievementChannelId);
    
    if (!achievementChannel) {
      console.error('⚠️ Achievement channel not found. Skipping announcement.');
      return;
    }

    // Format and send embeds
    const embeds = await formatAchievementDigest(newAchievements, client);
    
    for (const embed of embeds) {
      await achievementChannel.send({ embeds: [embed] });
    }

    console.log(`✅ Scheduled sync complete. Posted achievements for ${Object.keys(newAchievements).length} user(s).`);

  } catch (error) {
    console.error('❌ Error in scheduled sync:', error);
  }
}

/**
 * Initialize scheduler
 * @param {Client} client - Discord client
 */
export function initializeScheduler(client) {
  // Check if scheduling is enabled
  if (!config.discord.achievementChannelId) {
    console.log('⚠️ ACHIEVEMENT_CHANNEL_ID not set. Scheduled syncs disabled.');
    return;
  }

  // Use interval-based scheduling if configured
  if (config.scheduler.syncIntervalHours) {
    const intervalMs = config.scheduler.syncIntervalHours * 60 * 60 * 1000;
    console.log(`📅 Scheduler initialized: Every ${config.scheduler.syncIntervalHours} hour(s)`);
    
    setInterval(() => runScheduledSync(client), intervalMs);
    
    // Run initial sync after 5 minutes
    setTimeout(() => runScheduledSync(client), 5 * 60 * 1000);
    return;
  }

  // Use cron-based scheduling
  const schedule = parseCronSchedule(config.scheduler.cronSchedule);
  
  if (!schedule) {
    console.error('⚠️ Invalid cron schedule format. Scheduled syncs disabled.');
    return;
  }

  console.log(`📅 Scheduler initialized: ${config.scheduler.cronSchedule}`);
  console.log(`   Runs at: ${schedule.hours.join(', ')}:${schedule.minutes.toString().padStart(2, '0')}`);

  function scheduleNextRun() {
    const msUntilNext = getMillisecondsUntilNextRun(schedule);
    const nextRunDate = new Date(Date.now() + msUntilNext);
    
    console.log(`⏰ Next sync scheduled for: ${nextRunDate.toLocaleString()}`);

    setTimeout(async () => {
      await runScheduledSync(client);
      scheduleNextRun(); // Schedule next run after completion
    }, msUntilNext);
  }

  scheduleNextRun();
}

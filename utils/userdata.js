import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = join(__dirname, '../data/users.json');

/**
 * Initialize data file if it doesn't exist
 */
function initDataFile() {
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
}

/**
 * Read all user data
 * @returns {Object} All user data
 */
export function readUserData() {
  initDataFile();
  const data = readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write user data to file
 * @param {Object} data - User data object
 */
export function writeUserData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get a user's linked accounts
 * @param {string} discordId - Discord user ID
 * @returns {Object|null} User's linked accounts
 */
export function getUser(discordId) {
  const data = readUserData();
  return data[discordId] || null;
}

/**
 * Link a gaming account to Discord user
 * @param {string} discordId - Discord user ID
 * @param {string} platform - Platform name (steam, psn, xbox)
 * @param {string} accountId - Gaming account ID/username
 */
export function linkAccount(discordId, platform, accountId) {
  const data = readUserData();

  if (!data[discordId]) {
    data[discordId] = {
      steam: null,
      psn: null,
      xbox: null
    };
  }

  data[discordId][platform] = accountId;
  writeUserData(data);
}

/**
 * Unlink a gaming account from Discord user
 * @param {string} discordId - Discord user ID
 * @param {string} platform - Platform name (steam, psn, xbox)
 */
export function unlinkAccount(discordId, platform) {
  const data = readUserData();

  if (data[discordId]) {
    data[discordId][platform] = null;
    writeUserData(data);
  }
}

/**
 * Get all users with at least one linked account
 * @returns {Array} Array of user objects
 */
export function getAllUsers() {
  const data = readUserData();
  return Object.entries(data).map(([discordId, accounts]) => ({
    discordId,
    ...accounts
  }));
}

/**
 * Check if user has any linked accounts
 * @param {string} discordId - Discord user ID
 * @returns {boolean}
 */
export function hasLinkedAccounts(discordId) {
  const user = getUser(discordId);
  if (!user) return false;

  return user.steam !== null || user.psn !== null || user.xbox !== null;
}

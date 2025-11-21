import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

// Railway provides DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn('⚠️ DATABASE_URL is not defined. Database features will not work.');
} else {
    const masked = connectionString.replace(/:([^:@]+)@/, ':****@');
    console.log(`DEBUG: DATABASE_URL is set to: ${masked}`);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Required for Railway/Heroku connections
    }
});

// Test connection
pool.on('connect', () => {
    // console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;

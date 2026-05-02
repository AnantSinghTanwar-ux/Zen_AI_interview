import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hiring_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ...(process.env.DB_HOST && process.env.DB_HOST.includes('rlwy.net') ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Postgres connected');
  } catch (error) {
    if (process.env.REQUIRE_DB === 'true') {
      console.error('Database connection failed. Exiting...');
      console.error(error);
      process.exit(1);
    } else {
      console.warn('Postgres not available, continuing...');
    }
  }
};

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export default pool;

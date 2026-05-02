import pool from '../config/database';

async function patch() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;');
    console.log('Patch success');
  } catch (error) {
    console.error('Patch error:', error);
  } finally {
    pool.end();
  }
}

patch();

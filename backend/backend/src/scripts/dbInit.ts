import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import pool from '../config/database';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function run() {
  // Validate the minimum env needed to connect; `pool` reads these too,
  // but failing fast here gives a clearer error.
  requireEnv('DB_HOST');
  requireEnv('DB_PORT');
  requireEnv('DB_USER');
  requireEnv('DB_NAME');

  const schemaPath = path.resolve(process.cwd(), 'src', 'config', 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log(`Initialising database schema from ${schemaPath}...`);
    await client.query(schemaSql);
    console.log('Database schema initialised successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('db:init failed:', err);
  process.exit(1);
});

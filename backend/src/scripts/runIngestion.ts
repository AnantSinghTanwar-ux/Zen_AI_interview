/**
 * Roadmap Ingestion CLI Script
 *
 * Standalone script to run the roadmap ingestion pipeline.
 *
 * Usage:
 *   dotenv -e .env -- ts-node src/scripts/runIngestion.ts [--dry-run]
 *   npm run roadmap:ingest
 *   npm run roadmap:ingest -- --dry-run
 */

import 'dotenv/config';
import pool from '../config/database';
import { runFullIngestion } from '../services/ingestion.service';
import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('═══════════════════════════════════════════════════');
  console.log('  Roadmap Ingestion Pipeline');
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'FULL INGESTION'}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Verify DB connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connection verified\n');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  // Verify tables exist
  try {
    const client = await pool.connect();
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('roadmaps', 'roadmap_nodes', 'roadmap_edges', 'ingestion_runs')
      ORDER BY table_name
    `);
    client.release();

    const tables = tableCheck.rows.map((r: { table_name: string }) => r.table_name);
    const requiredTables = ['ingestion_runs', 'roadmap_edges', 'roadmap_nodes', 'roadmaps'];

    const missing = requiredTables.filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      console.log(`⚠️  Missing tables: ${missing.join(', ')}`);
      console.log('   Running migration to create tables...\n');

      // Auto-run migration
      const migrationPath = path.resolve(
        process.cwd(),
        'src',
        'config',
        'migrations',
        '004_create_roadmap_tables.sql',
      );
      const migrationSql = await fs.readFile(migrationPath, 'utf8');
      const migClient = await pool.connect();
      try {
        await migClient.query(migrationSql);
        console.log('✅ Migration executed successfully\n');
      } finally {
        migClient.release();
      }
    } else {
      console.log('✅ All required tables exist\n');
    }
  } catch (err) {
    console.error('❌ Table verification failed:', err);
    process.exit(1);
  }

  // Run ingestion
  try {
    const result = await runFullIngestion(dryRun);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  INGESTION RESULTS');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Run ID:        ${result.runId}`);
    console.log(`  Status:        ${result.status}`);
    console.log(`  Dry Run:       ${result.dryRun}`);
    console.log(`  Total:         ${result.totalRoadmaps}`);
    console.log(`  Success:       ${result.successCount}`);
    console.log(`  Failed:        ${result.failCount}`);
    console.log(`  Duration:      ${result.durationMs}ms`);
    console.log('═══════════════════════════════════════════════════\n');

    // Print per-roadmap details
    if (result.roadmapDetails.length > 0) {
      console.log('  Per-Roadmap Details:');
      for (const detail of result.roadmapDetails) {
        const status = detail.status === 'success' ? '✅' : detail.status === 'skipped' ? '⏭️' : '❌';
        console.log(
          `    ${status} ${detail.slug}: ${detail.nodesUpserted} nodes, ${detail.edgesUpserted} edges (${detail.durationMs}ms)`,
        );
        if (detail.warnings.length > 0) {
          for (const w of detail.warnings.slice(0, 3)) {
            console.log(`       ⚠️ ${w}`);
          }
          if (detail.warnings.length > 3) {
            console.log(`       ... and ${detail.warnings.length - 3} more warnings`);
          }
        }
      }
    }

    await pool.end();
    process.exit(result.status === 'completed' ? 0 : 1);
  } catch (err) {
    console.error('❌ Ingestion failed:', err);
    await pool.end();
    process.exit(1);
  }
}

main();

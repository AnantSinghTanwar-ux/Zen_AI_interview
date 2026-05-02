import pool from '../config/database';

export interface IngestionRun {
  id: string;
  source: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  logs: Record<string, unknown>[];
  created_at: Date;
}

export class IngestionRunModel {
  /**
   * Create a new ingestion run record.
   */
  static async create(source: string = 'github'): Promise<IngestionRun> {
    const { rows } = await pool.query<IngestionRun>(
      `INSERT INTO ingestion_runs (source, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING *`,
      [source],
    );
    return rows[0];
  }

  /**
   * Update status and append log entries.
   */
  static async updateStatus(
    id: string,
    status: 'completed' | 'failed',
    logs: Record<string, unknown>[],
  ): Promise<IngestionRun> {
    const completedAt = status === 'completed' || status === 'failed' ? 'NOW()' : 'NULL';
    const { rows } = await pool.query<IngestionRun>(
      `UPDATE ingestion_runs
       SET status       = $1,
           completed_at = ${completedAt},
           logs         = $2::jsonb
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(logs), id],
    );
    return rows[0];
  }

  /**
   * Find by ID.
   */
  static async findById(id: string): Promise<IngestionRun | null> {
    const { rows } = await pool.query<IngestionRun>(
      'SELECT * FROM ingestion_runs WHERE id = $1',
      [id],
    );
    return rows[0] || null;
  }

  /**
   * Paginated list of all ingestion runs, most recent first.
   */
  static async findAll(page: number, limit: number): Promise<{ rows: IngestionRun[]; total: number }> {
    const offset = (page - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM ingestion_runs');
    const total: number = countResult.rows[0].total;

    const { rows } = await pool.query<IngestionRun>(
      `SELECT * FROM ingestion_runs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return { rows, total };
  }
}

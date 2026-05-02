import pool from '../config/database';
import { PoolClient } from 'pg';

export interface Roadmap {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  source_url: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
  node_count?: number;
}

export interface RoadmapUpsertData {
  slug: string;
  title: string;
  description?: string;
  source_url?: string;
}

export class RoadmapModel {
  /**
   * Paginated list of all roadmaps with node count.
   */
  static async findAll(page: number, limit: number): Promise<{ rows: Roadmap[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM roadmaps');
    const total: number = countResult.rows[0].total;

    const { rows } = await pool.query<Roadmap>(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM roadmap_nodes WHERE roadmap_id = r.id) AS node_count
       FROM roadmaps r
       ORDER BY r.title ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return { rows, total };
  }

  /**
   * Find roadmap by UUID.
   */
  static async findById(id: string): Promise<Roadmap | null> {
    const { rows } = await pool.query<Roadmap>(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM roadmap_nodes WHERE roadmap_id = r.id) AS node_count
       FROM roadmaps r
       WHERE r.id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  /**
   * Find roadmap by slug.
   */
  static async findBySlug(slug: string): Promise<Roadmap | null> {
    const { rows } = await pool.query<Roadmap>(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM roadmap_nodes WHERE roadmap_id = r.id) AS node_count
       FROM roadmaps r
       WHERE r.slug = $1`,
      [slug],
    );
    return rows[0] || null;
  }

  /**
   * Idempotent upsert by slug. Returns the upserted roadmap.
   */
  static async upsertBySlug(data: RoadmapUpsertData, client: PoolClient): Promise<Roadmap> {
    const { rows } = await client.query<Roadmap>(
      `INSERT INTO roadmaps (slug, title, description, source_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         title       = EXCLUDED.title,
         description = EXCLUDED.description,
         source_url  = EXCLUDED.source_url,
         version     = roadmaps.version + 1,
         updated_at  = NOW()
       RETURNING *`,
      [data.slug, data.title, data.description || null, data.source_url || null],
    );
    return rows[0];
  }
}

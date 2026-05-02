import pool from '../config/database';
import { PoolClient } from 'pg';

export interface RoadmapNode {
  id: string;
  roadmap_id: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  parent_id: string | null;
  position_x: number;
  position_y: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface NodeUpsertData {
  roadmap_id: string;
  slug: string;
  title: string;
  description?: string;
  type?: string;
  parent_id?: string | null;
  position_x?: number;
  position_y?: number;
  sort_order?: number;
}

export class RoadmapNodeModel {
  /**
   * Upsert a batch of nodes. Returns all upserted node IDs.
   * Nodes are inserted one-by-one to handle parent references correctly.
   */
  static async upsertBatch(nodes: NodeUpsertData[], client: PoolClient): Promise<string[]> {
    const ids: string[] = [];

    for (const node of nodes) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO roadmap_nodes (roadmap_id, slug, title, description, type, parent_id, position_x, position_y, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (roadmap_id, slug) DO UPDATE SET
           title       = EXCLUDED.title,
           description = EXCLUDED.description,
           type        = EXCLUDED.type,
           parent_id   = EXCLUDED.parent_id,
           position_x  = EXCLUDED.position_x,
           position_y  = EXCLUDED.position_y,
           sort_order  = EXCLUDED.sort_order,
           updated_at  = NOW()
         RETURNING id`,
        [
          node.roadmap_id,
          node.slug,
          node.title,
          node.description || null,
          node.type || 'topic',
          node.parent_id || null,
          node.position_x ?? 0,
          node.position_y ?? 0,
          node.sort_order ?? 0,
        ],
      );
      ids.push(rows[0].id);
    }

    return ids;
  }

  /**
   * Get all nodes for a roadmap, ordered by sort_order.
   */
  static async findByRoadmap(roadmapId: string): Promise<RoadmapNode[]> {
    const { rows } = await pool.query<RoadmapNode>(
      `SELECT * FROM roadmap_nodes
       WHERE roadmap_id = $1
       ORDER BY sort_order ASC, title ASC`,
      [roadmapId],
    );
    return rows;
  }

  /**
   * Delete nodes for a roadmap that are NOT in the active IDs list.
   * Returns count of deleted rows.
   */
  static async deleteStale(
    roadmapId: string,
    activeIds: string[],
    client: PoolClient,
  ): Promise<number> {
    if (activeIds.length === 0) {
      // Delete all nodes for this roadmap
      const result = await client.query(
        'DELETE FROM roadmap_nodes WHERE roadmap_id = $1',
        [roadmapId],
      );
      return result.rowCount ?? 0;
    }

    const result = await client.query(
      `DELETE FROM roadmap_nodes
       WHERE roadmap_id = $1
         AND id != ALL($2::uuid[])`,
      [roadmapId, activeIds],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Find a node by roadmap_id and slug. Used for resolving parent references.
   */
  static async findBySlug(
    roadmapId: string,
    slug: string,
    client?: PoolClient,
  ): Promise<RoadmapNode | null> {
    const db = client || pool;
    const { rows } = await db.query<RoadmapNode>(
      'SELECT * FROM roadmap_nodes WHERE roadmap_id = $1 AND slug = $2',
      [roadmapId, slug],
    );
    return rows[0] || null;
  }
}

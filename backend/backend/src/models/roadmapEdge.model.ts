import pool from '../config/database';
import { PoolClient } from 'pg';

export interface RoadmapEdge {
  id: string;
  roadmap_id: string;
  source_node_id: string;
  target_node_id: string;
  created_at: Date;
}

export interface EdgeUpsertData {
  roadmap_id: string;
  source_node_id: string;
  target_node_id: string;
}

export class RoadmapEdgeModel {
  /**
   * Upsert a batch of edges. Returns all upserted edge IDs.
   */
  static async upsertBatch(edges: EdgeUpsertData[], client: PoolClient): Promise<string[]> {
    const ids: string[] = [];

    for (const edge of edges) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO roadmap_edges (roadmap_id, source_node_id, target_node_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (roadmap_id, source_node_id, target_node_id) DO UPDATE SET
           roadmap_id = EXCLUDED.roadmap_id
         RETURNING id`,
        [edge.roadmap_id, edge.source_node_id, edge.target_node_id],
      );
      ids.push(rows[0].id);
    }

    return ids;
  }

  /**
   * Get all edges for a roadmap.
   */
  static async findByRoadmap(roadmapId: string): Promise<RoadmapEdge[]> {
    const { rows } = await pool.query<RoadmapEdge>(
      `SELECT * FROM roadmap_edges
       WHERE roadmap_id = $1
       ORDER BY created_at ASC`,
      [roadmapId],
    );
    return rows;
  }

  /**
   * Delete edges for a roadmap that are NOT in the active IDs list.
   * Returns count of deleted rows.
   */
  static async deleteStale(
    roadmapId: string,
    activeIds: string[],
    client: PoolClient,
  ): Promise<number> {
    if (activeIds.length === 0) {
      const result = await client.query(
        'DELETE FROM roadmap_edges WHERE roadmap_id = $1',
        [roadmapId],
      );
      return result.rowCount ?? 0;
    }

    const result = await client.query(
      `DELETE FROM roadmap_edges
       WHERE roadmap_id = $1
         AND id != ALL($2::uuid[])`,
      [roadmapId, activeIds],
    );
    return result.rowCount ?? 0;
  }
}

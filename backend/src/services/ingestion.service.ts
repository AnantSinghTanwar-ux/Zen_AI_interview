/**
 * Ingestion Service
 *
 * Orchestrates the full roadmap ingestion pipeline:
 *   1. Create ingestion run record
 *   2. Load source data
 *   3. Parse into structured entities
 *   4. Persist to database (transactional, idempotent)
 *   5. Mark run complete/failed
 *
 * Features:
 *   - Uses withTransaction for atomicity per-roadmap
 *   - Performance timing for each phase
 *   - Partial failure protection (per-roadmap try/catch)
 *   - Dry-run mode (parse only, no DB writes)
 */

import { withTransaction } from '../utils/transaction';
import { IngestionRunModel } from '../models/ingestionRun.model';
import { RoadmapModel } from '../models/roadmap.model';
import { RoadmapNodeModel } from '../models/roadmapNode.model';
import { RoadmapEdgeModel } from '../models/roadmapEdge.model';
import { loadAllRoadmaps, getLoaderLogs, clearLoaderLogs } from './roadmapLoader';
import { parseAllRoadmaps, ParseResult } from './roadmapParser';
import { PoolClient } from 'pg';

interface IngestionResult {
  runId: string;
  status: 'completed' | 'failed';
  dryRun: boolean;
  totalRoadmaps: number;
  successCount: number;
  failCount: number;
  durationMs: number;
  roadmapDetails: RoadmapIngestionDetail[];
  logs: Record<string, unknown>[];
}

interface RoadmapIngestionDetail {
  slug: string;
  status: 'success' | 'failed' | 'skipped';
  nodesUpserted: number;
  edgesUpserted: number;
  staleNodesRemoved: number;
  staleEdgesRemoved: number;
  durationMs: number;
  error?: string;
  warnings: string[];
}

/**
 * Run the full ingestion pipeline.
 */
export async function runFullIngestion(dryRun: boolean = false): Promise<IngestionResult> {
  const startTime = Date.now();
  clearLoaderLogs();

  console.log(`\n🚀 Starting roadmap ingestion pipeline (dryRun: ${dryRun})...\n`);

  // 1. Create ingestion run record
  const run = await IngestionRunModel.create('github');
  const logs: Record<string, unknown>[] = [];

  logs.push({
    phase: 'init',
    message: 'Ingestion run created',
    runId: run.id,
    dryRun,
    timestamp: new Date().toISOString(),
  });

  const roadmapDetails: RoadmapIngestionDetail[] = [];
  let successCount = 0;
  let failCount = 0;

  try {
    // 2. Load source data
    const loadStart = Date.now();
    console.log('📥 Loading roadmap source data...');
    const rawDataList = await loadAllRoadmaps();
    const loadDuration = Date.now() - loadStart;

    logs.push({
      phase: 'load',
      message: `Loaded ${rawDataList.length} roadmaps`,
      durationMs: loadDuration,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Loaded ${rawDataList.length} roadmaps in ${loadDuration}ms\n`);

    // 3. Parse data
    const parseStart = Date.now();
    console.log('🧠 Parsing roadmap data...');
    const parsedResults = parseAllRoadmaps(rawDataList);
    const parseDuration = Date.now() - parseStart;

    const totalNodes = parsedResults.reduce((sum, r) => sum + r.nodes.length, 0);
    const totalEdges = parsedResults.reduce((sum, r) => sum + r.edges.length, 0);

    logs.push({
      phase: 'parse',
      message: `Parsed ${parsedResults.length} roadmaps: ${totalNodes} nodes, ${totalEdges} edges`,
      durationMs: parseDuration,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `✅ Parsed ${parsedResults.length} roadmaps: ${totalNodes} nodes, ${totalEdges} edges (${parseDuration}ms)\n`,
    );

    if (dryRun) {
      // Dry run — report results without DB writes
      console.log('🔍 Dry run mode — skipping database persistence\n');

      for (const parsed of parsedResults) {
        roadmapDetails.push({
          slug: parsed.roadmap.slug,
          status: 'skipped',
          nodesUpserted: parsed.nodes.length,
          edgesUpserted: parsed.edges.length,
          staleNodesRemoved: 0,
          staleEdgesRemoved: 0,
          durationMs: 0,
          warnings: parsed.warnings,
        });

        if (parsed.warnings.length > 0) {
          console.log(`  ⚠️ ${parsed.roadmap.slug}: ${parsed.warnings.length} warnings`);
        }
      }

      successCount = parsedResults.length;
    } else {
      // 4. Persist to database in controlled concurrency batches
      console.log('💾 Persisting to database in batches...\n');

      const BATCH_SIZE = 5;
      for (let i = 0; i < parsedResults.length; i += BATCH_SIZE) {
        const batch = parsedResults.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.all(
          batch.map(parsed => persistRoadmap(parsed))
        );

        for (const detail of results) {
          roadmapDetails.push(detail);
          if (detail.status === 'success') {
            successCount++;
            console.log(`  ✅ ${detail.slug}: ${detail.nodesUpserted} nodes, ${detail.edgesUpserted} edges (${detail.durationMs}ms)`);
          } else {
            failCount++;
            console.log(`  ❌ ${detail.slug}: ${detail.error}`);
          }
        }
      }
    }

    // 5. Mark complete
    const totalDuration = Date.now() - startTime;
    // Strict failure - if there is EVEN ONE fail, mark the entire run failed
    const finalStatus = failCount > 0 ? 'failed' : 'completed';

    logs.push({
      phase: 'complete',
      message: `Ingestion ${finalStatus}: ${successCount} success, ${failCount} failed`,
      durationMs: totalDuration,
      timestamp: new Date().toISOString(),
    });

    // Append loader logs
    logs.push(...getLoaderLogs().map((l) => ({ ...l, phase: 'loader' })));

    await IngestionRunModel.updateStatus(run.id, finalStatus, logs);

    console.log(
      `\n🏁 Ingestion ${finalStatus}: ${successCount} success, ${failCount} failed (${totalDuration}ms)\n`,
    );

    return {
      runId: run.id,
      status: finalStatus,
      dryRun,
      totalRoadmaps: parsedResults.length,
      successCount,
      failCount,
      durationMs: totalDuration,
      roadmapDetails,
      logs,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const totalDuration = Date.now() - startTime;

    logs.push({
      phase: 'error',
      message: `Pipeline error: ${errorMessage}`,
      durationMs: totalDuration,
      timestamp: new Date().toISOString(),
    });

    await IngestionRunModel.updateStatus(run.id, 'failed', logs);

    console.error(`\n💥 Ingestion pipeline error: ${errorMessage}\n`);

    return {
      runId: run.id,
      status: 'failed',
      dryRun,
      totalRoadmaps: 0,
      successCount: 0,
      failCount: 1,
      durationMs: totalDuration,
      roadmapDetails,
      logs,
    };
  }
}

/**
 * Persist a single parsed roadmap with transactional safety.
 */
async function persistRoadmap(parsed: ParseResult): Promise<RoadmapIngestionDetail> {
  const startTime = Date.now();

  try {
    const result = await withTransaction(async (client: PoolClient) => {
      // Upsert roadmap
      const roadmap = await RoadmapModel.upsertBySlug(
        {
          slug: parsed.roadmap.slug,
          title: parsed.roadmap.title,
          description: parsed.roadmap.description,
          source_url: parsed.roadmap.source_url,
        },
        client,
      );

      // Upsert nodes (without parent_id first, then update parents)
      // First pass: upsert all nodes without parent references
      const nodesWithoutParent = parsed.nodes.map((n) => ({
        roadmap_id: roadmap.id,
        slug: n.slug,
        title: n.title,
        description: n.description,
        type: n.type,
        parent_id: null as string | null,
        position_x: n.positionX,
        position_y: n.positionY,
        sort_order: n.sortOrder,
      }));

      const nodeIds = await RoadmapNodeModel.upsertBatch(nodesWithoutParent, client);

      // Build slug→id map for parent resolution
      const slugToId = new Map<string, string>();
      for (let i = 0; i < parsed.nodes.length; i++) {
        slugToId.set(parsed.nodes[i].slug, nodeIds[i]);
      }

      // Second pass: update parent references
      for (let i = 0; i < parsed.nodes.length; i++) {
        const node = parsed.nodes[i];
        if (node.parentSlug) {
          const parentId = slugToId.get(node.parentSlug);
          if (parentId) {
            await client.query(
              'UPDATE roadmap_nodes SET parent_id = $1 WHERE id = $2',
              [parentId, nodeIds[i]],
            );
          }
        }
      }

      // Delete stale nodes (not in current set)
      const staleNodesRemoved = await RoadmapNodeModel.deleteStale(
        roadmap.id,
        nodeIds,
        client,
      );

      // Upsert edges
      const edgeData = parsed.edges
        .map((e) => {
          const sourceId = slugToId.get(e.sourceSlug);
          const targetId = slugToId.get(e.targetSlug);
          if (!sourceId || !targetId) return null;
          return {
            roadmap_id: roadmap.id,
            source_node_id: sourceId,
            target_node_id: targetId,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      const edgeIds = edgeData.length > 0
        ? await RoadmapEdgeModel.upsertBatch(edgeData, client)
        : [];

      // Delete stale edges
      const staleEdgesRemoved = await RoadmapEdgeModel.deleteStale(
        roadmap.id,
        edgeIds,
        client,
      );

      return {
        nodesUpserted: nodeIds.length,
        edgesUpserted: edgeIds.length,
        staleNodesRemoved,
        staleEdgesRemoved,
      };
    });

    return {
      slug: parsed.roadmap.slug,
      status: 'success',
      nodesUpserted: result.nodesUpserted,
      edgesUpserted: result.edgesUpserted,
      staleNodesRemoved: result.staleNodesRemoved,
      staleEdgesRemoved: result.staleEdgesRemoved,
      durationMs: Date.now() - startTime,
      warnings: parsed.warnings,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      slug: parsed.roadmap.slug,
      status: 'failed',
      nodesUpserted: 0,
      edgesUpserted: 0,
      staleNodesRemoved: 0,
      staleEdgesRemoved: 0,
      durationMs: Date.now() - startTime,
      error: errorMessage,
      warnings: parsed.warnings,
    };
  }
}

/**
 * Get the status/result of an ingestion run.
 */
export async function getIngestionRunStatus(runId: string) {
  return IngestionRunModel.findById(runId);
}

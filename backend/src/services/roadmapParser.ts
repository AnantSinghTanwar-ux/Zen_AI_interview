/**
 * Roadmap Data Parser
 *
 * Transforms raw roadmap data from the loader into structured entities
 * ready for database persistence.
 *
 * Handles:
 * - Nested node hierarchies → flattened list with parent references
 * - Slug generation and deduplication
 * - Circular reference detection via DFS
 * - Position and sort_order computation
 */

import { RawRoadmapData, RawNode, RawEdge, slugify } from './roadmapLoader';

export interface ParsedRoadmap {
  slug: string;
  title: string;
  description: string;
  source_url: string;
}

export interface ParsedNode {
  slug: string;
  title: string;
  description: string;
  type: string;
  parentSlug: string | null;
  positionX: number;
  positionY: number;
  sortOrder: number;
}

export interface ParsedEdge {
  sourceSlug: string;
  targetSlug: string;
}

export interface ParseResult {
  roadmap: ParsedRoadmap;
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  warnings: string[];
}

/**
 * Parse a raw roadmap dataset into structured entities.
 */
export function parseRoadmap(raw: RawRoadmapData): ParseResult {
  const warnings: string[] = [];
  const slugSet = new Set<string>();

  // Parse roadmap metadata
  const roadmap: ParsedRoadmap = {
    slug: raw.slug,
    title: raw.title,
    description: raw.description,
    source_url: raw.source_url,
  };

  // Flatten and parse nodes
  const flatNodes: ParsedNode[] = [];
  let sortCounter = 0;

  function processNode(node: RawNode, parentSlug: string | null, depth: number): void {
    // Generate unique slug
    let nodeSlug = slugify(node.id || node.title);
    if (!nodeSlug) {
      nodeSlug = `node-${sortCounter}`;
    }

    // Handle duplicate slugs
    if (slugSet.has(nodeSlug)) {
      const original = nodeSlug;
      let suffix = 2;
      while (slugSet.has(`${nodeSlug}-${suffix}`)) {
        suffix++;
      }
      nodeSlug = `${nodeSlug}-${suffix}`;
      warnings.push(`Duplicate slug "${original}" renamed to "${nodeSlug}"`);
    }

    slugSet.add(nodeSlug);

    flatNodes.push({
      slug: nodeSlug,
      title: node.title || nodeSlug,
      description: node.description || '',
      type: node.type || (depth === 0 ? 'category' : 'topic'),
      parentSlug: parentSlug,
      positionX: node.positionX ?? 0,
      positionY: node.positionY ?? depth * 100,
      sortOrder: sortCounter++,
    });

    // Process children recursively
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        processNode(child, nodeSlug, depth + 1);
      }
    }
  }

  // Process all top-level nodes
  for (const node of raw.nodes) {
    processNode(node, null, 0);
  }

  // Parse edges — map from raw IDs to slugs
  const rawIdToSlug = new Map<string, string>();
  for (let i = 0; i < raw.nodes.length; i++) {
    buildIdMap(raw.nodes[i], flatNodes, rawIdToSlug, i);
  }

  const edges: ParsedEdge[] = [];
  const edgeSet = new Set<string>();

  for (const rawEdge of raw.edges) {
    const sourceSlug = rawIdToSlug.get(rawEdge.sourceId);
    const targetSlug = rawIdToSlug.get(rawEdge.targetId);

    if (!sourceSlug || !targetSlug) {
      warnings.push(
        `Edge skipped: source="${rawEdge.sourceId}" or target="${rawEdge.targetId}" not found`,
      );
      continue;
    }

    if (sourceSlug === targetSlug) {
      warnings.push(`Self-referencing edge skipped: "${sourceSlug}"`);
      continue;
    }

    const edgeKey = `${sourceSlug}→${targetSlug}`;
    if (edgeSet.has(edgeKey)) {
      warnings.push(`Duplicate edge skipped: ${edgeKey}`);
      continue;
    }

    edgeSet.add(edgeKey);
    edges.push({ sourceSlug, targetSlug });
  }

  // Circular reference detection
  const circularWarnings = detectCircularReferences(edges);
  warnings.push(...circularWarnings);

  return { roadmap, nodes: flatNodes, edges, warnings };
}

/**
 * Build a mapping from raw node IDs to their generated slugs.
 */
function buildIdMap(
  node: RawNode,
  flatNodes: ParsedNode[],
  idMap: Map<string, string>,
  _index: number,
): void {
  // Find the matching flat node by matching the raw ID to slug
  const slug = slugify(node.id || node.title);
  const found = flatNodes.find((fn) => fn.slug === slug || fn.slug.startsWith(slug));

  if (found) {
    idMap.set(node.id, found.slug);
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      buildIdMap(node.children[i], flatNodes, idMap, i);
    }
  }
}

/**
 * Detect circular references in the edge graph using DFS.
 * Returns warnings for any cycles found. Does NOT remove the edges,
 * just reports them.
 */
function detectCircularReferences(edges: ParsedEdge[]): string[] {
  const warnings: string[] = [];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceSlug)) {
      adjacency.set(edge.sourceSlug, []);
    }
    adjacency.get(edge.sourceSlug)!.push(edge.targetSlug);
  }

  // DFS cycle detection
  const WHITE = 0; // unvisited
  const GRAY = 1; // in current path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  const allNodes = new Set<string>();
  for (const edge of edges) {
    allNodes.add(edge.sourceSlug);
    allNodes.add(edge.targetSlug);
  }
  for (const node of allNodes) {
    color.set(node, WHITE);
  }

  function dfs(node: string, path: string[]): void {
    color.set(node, GRAY);
    path.push(node);

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor) ?? WHITE;
      if (neighborColor === GRAY) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart).concat(neighbor);
        warnings.push(`Circular reference detected: ${cycle.join(' → ')}`);
      } else if (neighborColor === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    color.set(node, BLACK);
  }

  for (const node of allNodes) {
    if (color.get(node) === WHITE) {
      dfs(node, []);
    }
  }

  return warnings;
}

/**
 * Parse multiple raw roadmaps.
 */
export function parseAllRoadmaps(rawDataList: RawRoadmapData[]): ParseResult[] {
  return rawDataList.map((raw) => {
    try {
      return parseRoadmap(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        roadmap: {
          slug: raw.slug,
          title: raw.title,
          description: raw.description || '',
          source_url: raw.source_url || '',
        },
        nodes: [],
        edges: [],
        warnings: [`Parse error: ${message}`],
      };
    }
  });
}

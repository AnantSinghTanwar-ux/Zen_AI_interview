import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Roadmap Source Loader
 *
 * Strategy:
 *   1. Resolve Source: Local Repo (if ROADMAP_LOCAL_REPO_PATH is set) or GitHub Raw.
 *   2. Fetch Metadata: Parse frontmatter from `[slug].md`.
 *   3. Parse Graph: Try reading `content-paths.json`. If unavailable, dynamically parse
 *      the markdown headings in `[slug].md` to construct a hierarchical node graph.
 *   4. Strict Validation: No fallback placeholders. If parsing yields < expected nodes, it throws.
 */

export const ROADMAP_SLUGS = [
  'frontend', 'backend', 'devops', 'full-stack', 'ai-data-scientist',
  'android', 'ios', 'postgresql-dba', 'blockchain', 'qa',
  'software-architect', 'cyber-security', 'ux-design', 'react',
  'angular', 'vue', 'nodejs', 'typescript', 'javascript', 'python',
  'java', 'golang', 'rust', 'cpp', 'docker', 'kubernetes', 'aws',
  'linux', 'mongodb', 'graphql', 'sql', 'git-github', 'system-design',
  'api-design', 'software-design-architecture', 'mlops', 'data-analyst',
  'devrel', 'technical-writer', 'game-developer', 'server-side-game-developer',
  'prompt-engineering', 'computer-science', 'redis', 'flutter', 'react-native',
];

export interface RawRoadmapData {
  slug: string;
  title: string;
  description: string;
  source_url: string;
  nodes: RawNode[];
  edges: RawEdge[];
  loadedFrom: 'github-json' | 'github-markdown' | 'local-json' | 'local-markdown';
}

export interface RawNode {
  id: string;
  title: string;
  description: string;
  type: string;
  parentId: string | null;
  positionX: number;
  positionY: number;
  children: RawNode[];
}

export interface RawEdge {
  sourceId: string;
  targetId: string;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const logs: LogEntry[] = [];

function log(level: LogEntry['level'], message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = { level, message, timestamp: new Date().toISOString(), data };
  logs.push(entry);
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [RoadmapLoader] ${message}`, data ? JSON.stringify(data) : '');
}

export function getLoaderLogs(): LogEntry[] {
  return [...logs];
}

export function clearLoaderLogs(): void {
  logs.length = 0;
}

// ─── Network Utilities ────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 15000): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log('warn', `Attempt ${attempt}/${maxRetries} failed for ${url}`, { error: lastError.message });
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// ─── Source Resolvers ─────────────────────────────────────────────────────────

async function getFileContent(slug: string, filename: string): Promise<{ content: string; source: 'local' | 'github' }> {
  const localRepo = process.env.ROADMAP_LOCAL_REPO_PATH;
  
  if (localRepo) {
    try {
      const filePath = path.join(localRepo, 'src', 'data', 'roadmaps', slug, filename);
      const content = await fs.readFile(filePath, 'utf8');
      return { content, source: 'local' };
    } catch (err) {
      // Fall through to github if local fails, or throw? The requirement is "optional local repository mode"
      // If local is explicitly set, and file missing, we can try remote as fallback or just fail. Let's try remote.
    }
  }

  const url = `https://raw.githubusercontent.com/kamranahmedse/developer-roadmap/master/src/data/roadmaps/${slug}/${filename}`;
  const content = await fetchWithRetry(url, 2, 10000);
  return { content, source: 'github' };
}

// ─── Core Loading Logic ───────────────────────────────────────────────────────

export async function loadRoadmap(slug: string): Promise<RawRoadmapData | null> {
  try {
    log('info', `Loading roadmap: ${slug}`);

    // 1. Fetch `[slug].md` (contains frontmatter + markdown body)
    const { content: mdContent, source } = await getFileContent(slug, `${slug}.md`);

    const title = extractFrontmatterField(mdContent, 'title') || formatTitle(slug);
    const description = extractFrontmatterField(mdContent, 'description') || `${title} roadmap`;
    const sourceUrl = `https://roadmap.sh/${slug}`;

    let nodes: RawNode[] = [];
    let edges: RawEdge[] = [];
    let loadedMode: 'json' | 'markdown' = 'json';

    // 2. Try fetching `[slug].json` (the new React Flow format roadmap.sh uses)
    try {
      const { content: jsonContent } = await getFileContent(slug, `${slug}.json`);
      const flowData = JSON.parse(jsonContent);
      const parsed = parseReactFlowJson(flowData, slug);
      nodes = parsed.nodes;
      edges = parsed.edges;
      loadedMode = 'json';
    } catch (err) {
      // 3. Fallback to Markdown Parser
      log('info', `No JSON structure available for ${slug}, falling back to markdown parser`);
      const parsed = parseMarkdownStructure(mdContent, slug);
      nodes = parsed.nodes;
      edges = parsed.edges;
      loadedMode = 'markdown';
    }

    // 4. Validate Minimum Threshold
    if (nodes.length < 5) {
      throw new Error(`Validation failed: Parsed only ${nodes.length} nodes (expected >= 5). No placeholders allowed.`);
    }

    log('info', `Successfully loaded ${slug}`, { source, loadedMode, nodes: nodes.length, edges: edges.length });

    return {
      slug,
      title,
      description,
      source_url: sourceUrl,
      nodes,
      edges,
      loadedFrom: `${source}-${loadedMode}` as any,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('error', `Failed to load ${slug}: ${msg}`);
    // Return null to signify explicit failure, which ingestion.service will catch.
    return null;
  }
}

export async function loadAllRoadmaps(): Promise<RawRoadmapData[]> {
  log('info', `Starting to load ${ROADMAP_SLUGS.length} roadmaps`);
  clearLoaderLogs();

  const results: RawRoadmapData[] = [];
  // For loader, we just return the ones that succeeded. The service will handle checking fail counts.
  for (const slug of ROADMAP_SLUGS) {
    const data = await loadRoadmap(slug);
    if (data) results.push(data);
  }
  return results;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function extractFrontmatterField(content: string, field: string): string | null {
  const match = content.match(new RegExp(`^${field}:\\s*['"]?(.+?)['"]?\\s*$`, 'm'));
  return match ? match[1].trim() : null;
}

function formatTitle(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 200);
}

// ─── JSON Parser ───

function parseReactFlowJson(data: any, slug: string) {
  const nodes: RawNode[] = [];
  const edges: RawEdge[] = [];

  if (!data || !data.nodes || !data.edges) {
    throw new Error('Invalid JSON format: missing nodes or edges array');
  }

  // Map React Flow nodes
  for (const n of data.nodes) {
    // Only parse valid nodes with a label
    const title = n.data?.title || n.data?.label || n.data?.heading || '';
    if (!title) continue;

    nodes.push({
      id: n.id,
      title: title,
      description: n.data?.description || '',
      type: n.type || 'topic',
      parentId: n.parentNode || null,
      positionX: Math.round(n.position?.x || 0),
      positionY: Math.round(n.position?.y || 0),
      children: [],
    });
  }

  // Create Parent-Child links
  const nodeMap = new Map<string, RawNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Map React Flow edges
  for (const e of data.edges) {
    const source = nodeMap.get(e.source);
    const target = nodeMap.get(e.target);
    if (!source || !target) continue;

    edges.push({ sourceId: e.source, targetId: e.target });
    source.children.push(target);
    if (!target.parentId) {
      target.parentId = source.id;
    }
  }

  return { nodes, edges };
}

// ─── Markdown Parser ───

function parseMarkdownStructure(content: string, slug: string) {
  const nodes: RawNode[] = [];
  const edges: RawEdge[] = [];
  const lines = content.split('\n');
  
  // Track the most recent node created at each heading level (1 to 6)
  const activeStack: (RawNode | null)[] = Array(7).fill(null);
  
  let inFrontmatter = false;
  let sortOrders = Array(7).fill(0);

  // We enforce a root node representing the roadmap itself
  const rootNode: RawNode = {
    id: `${slug}-root`,
    title: formatTitle(slug),
    description: '',
    type: 'root',
    parentId: null,
    positionX: 0,
    positionY: 0,
    children: [],
  };
  nodes.push(rootNode);
  activeStack[1] = rootNode; // Treat the root as an implicit H1 if none exists

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip frontmatter
    if (line === '---' && i < 5) {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    // Detect heading
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length;
    let title = match[2].replace(/\[(.*?)\]\(.*?\)/g, '$1').trim(); // Remove markdown links

    if (!title) continue;

    sortOrders[level]++;
    // Reset lower level sort orders
    for (let j = level + 1; j < 7; j++) sortOrders[j] = 0;

    // Find parent logic:
    // Parent is the nearest lower-level heading (e.g. H3's parent is the active H2, or H1)
    let parentLevel = level - 1;
    while (parentLevel > 0 && !activeStack[parentLevel]) {
      parentLevel--;
    }
    const parentNode = parentLevel > 0 ? activeStack[parentLevel] : rootNode;
    
    // Prevent self-referencing or creating duplicate root
    if (level === 1 && nodes.length === 1) {
      // It's the first H1, just rename the root node
      rootNode.title = title;
      continue;
    }

    const nodeId = `${slug}-${slugify(title)}-L${level}-${sortOrders[level]}`;
    
    const node: RawNode = {
      id: nodeId,
      title,
      description: '',
      type: level === 2 ? 'category' : 'topic',
      parentId: parentNode?.id || null,
      positionX: sortOrders[level],
      positionY: (level - 1) * 100, // root is 0, H2 is 100, H3 is 200
      children: [],
    };

    nodes.push(node);
    activeStack[level] = node;

    if (parentNode) {
      edges.push({ sourceId: parentNode.id, targetId: nodeId });
      parentNode.children.push(node);
    }
    
    // Clear out deeper levels from stack since we climbed up or stayed parallel
    for (let l = level + 1; l <= 6; l++) {
      activeStack[l] = null;
    }
  }

  // Create sequential edges between all same-level top categories (H2s)
  const categories = nodes.filter(n => n.type === 'category');
  for (let i = 0; i < categories.length - 1; i++) {
    edges.push({ sourceId: categories[i].id, targetId: categories[i+1].id });
  }

  return { nodes, edges };
}

export function getRoadmapSlugs(): string[] {
  return [...ROADMAP_SLUGS];
}

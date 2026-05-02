import { ApplicantProfileModel } from '../models/applicantProfile.model';
import { RoadmapModel } from '../models/roadmap.model';
import { RoadmapNodeModel, RoadmapNode } from '../models/roadmapNode.model';
import { RoadmapEdgeModel, RoadmapEdge } from '../models/roadmapEdge.model';
import { AppError } from '../utils/appError';

// ── Types ───────────────────────────────────────────────────────────────────────

export type MatchType = 'exact' | 'normalized' | null;

export interface MatchDetail {
  nodeId: string;
  nodeTitle: string;
  nodeSlug: string;
  matchedSkill: string | null;
  matchType: MatchType;
}

export interface RoadmapProgress {
  roadmap: {
    id: string;
    slug: string;
    title: string;
  };
  completionPercentage: number;
  totalNodes: number;
  completedNodes: { id: string; title: string; slug: string; matchedSkill: string }[];
  pendingNodes: { id: string; title: string; slug: string }[];
  matchDetails: MatchDetail[];
}

export interface SkillRecommendation {
  recommendedNode: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    type: string;
  };
  reason: string;
  prerequisitesSatisfied: { id: string; title: string }[];
  estimatedProgressGain: number;
  learningResources: string | null;
}

// ── Skill Normalization ─────────────────────────────────────────────────────────

/**
 * Normalize a skill string for fuzzy matching:
 * lowercase → trim → collapse whitespace → strip dots/dashes/hashes/pluses → slugify
 * e.g. "React.js" → "reactjs", "Node JS" → "nodejs", "C++" → "c++"
 */
export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')        // collapse whitespace
    .replace(/[.\-_#]/g, '');   // strip dots, dashes, underscores, hashes
}

// ── Skill Matching ──────────────────────────────────────────────────────────────

/**
 * Check if a user skill matches a roadmap node title.
 * Returns 'exact' for case-sensitive match, 'normalized' for fuzzy match, null otherwise.
 */
export function matchSkillToNode(skill: string, nodeTitle: string): MatchType {
  // Exact match (case-sensitive, trimmed)
  if (skill.trim() === nodeTitle.trim()) {
    return 'exact';
  }

  // Normalized match
  if (normalizeSkill(skill) === normalizeSkill(nodeTitle)) {
    return 'normalized';
  }

  return null;
}

/**
 * Match user skills against roadmap nodes.
 * Each node is matched at most once (first matching skill wins).
 */
export function findMatchedNodes(
  userSkills: string[],
  nodes: RoadmapNode[],
): MatchDetail[] {
  if (!userSkills || userSkills.length === 0 || !nodes || nodes.length === 0) {
    return nodes.map((n) => ({
      nodeId: n.id,
      nodeTitle: n.title,
      nodeSlug: n.slug,
      matchedSkill: null,
      matchType: null,
    }));
  }

  return nodes.map((node) => {
    // Try exact match first, then normalized
    for (const skill of userSkills) {
      const match = matchSkillToNode(skill, node.title);
      if (match === 'exact') {
        return {
          nodeId: node.id,
          nodeTitle: node.title,
          nodeSlug: node.slug,
          matchedSkill: skill,
          matchType: 'exact' as MatchType,
        };
      }
    }

    // Second pass: normalized match
    for (const skill of userSkills) {
      const match = matchSkillToNode(skill, node.title);
      if (match === 'normalized') {
        return {
          nodeId: node.id,
          nodeTitle: node.title,
          nodeSlug: node.slug,
          matchedSkill: skill,
          matchType: 'normalized' as MatchType,
        };
      }
    }

    return {
      nodeId: node.id,
      nodeTitle: node.title,
      nodeSlug: node.slug,
      matchedSkill: null,
      matchType: null,
    };
  });
}

// ── DAG Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build prerequisite map: nodeId → set of prerequisite node IDs.
 * An edge (source → target) means source is a prerequisite for target.
 */
function buildPrerequisiteMap(edges: RoadmapEdge[]): Map<string, Set<string>> {
  const prereqs = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!prereqs.has(edge.target_node_id)) {
      prereqs.set(edge.target_node_id, new Set());
    }
    prereqs.get(edge.target_node_id)!.add(edge.source_node_id);
  }
  return prereqs;
}

/**
 * Build dependents map: nodeId → set of nodes that depend on it.
 */
function buildDependentsMap(edges: RoadmapEdge[]): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!deps.has(edge.source_node_id)) {
      deps.set(edge.source_node_id, new Set());
    }
    deps.get(edge.source_node_id)!.add(edge.target_node_id);
  }
  return deps;
}

// ── Main Service ────────────────────────────────────────────────────────────────

export const RoadmapProgressService = {
  /**
   * Compute roadmap progress for a given user.
   * Returns structured progress data including completion %, matched/pending nodes.
   */
  async getUserRoadmapProgress(userId: string, roadmapId: string): Promise<RoadmapProgress> {
    // 1. Fetch roadmap
    const roadmap = await RoadmapModel.findById(roadmapId);
    if (!roadmap) {
      throw new AppError('Roadmap not found', 404);
    }

    // 2. Fetch user profile + skills
    const profile = await ApplicantProfileModel.findByUserId(userId);
    const userSkills: string[] = profile?.skills ?? [];

    // 3. Fetch roadmap nodes
    const nodes = await RoadmapNodeModel.findByRoadmap(roadmapId);
    if (nodes.length === 0) {
      return {
        roadmap: { id: roadmap.id, slug: roadmap.slug, title: roadmap.title },
        completionPercentage: 0,
        totalNodes: 0,
        completedNodes: [],
        pendingNodes: [],
        matchDetails: [],
      };
    }

    // 4. Match skills to nodes
    const matchDetails = findMatchedNodes(userSkills, nodes);

    // 5. Classify nodes
    const completedNodes = matchDetails
      .filter((m) => m.matchType !== null)
      .map((m) => ({
        id: m.nodeId,
        title: m.nodeTitle,
        slug: m.nodeSlug,
        matchedSkill: m.matchedSkill!,
      }));

    const pendingNodes = matchDetails
      .filter((m) => m.matchType === null)
      .map((m) => ({
        id: m.nodeId,
        title: m.nodeTitle,
        slug: m.nodeSlug,
      }));

    // 6. Compute completion percentage
    const completionPercentage =
      nodes.length > 0 ? Math.round((completedNodes.length / nodes.length) * 100) : 0;

    return {
      roadmap: { id: roadmap.id, slug: roadmap.slug, title: roadmap.title },
      completionPercentage,
      totalNodes: nodes.length,
      completedNodes,
      pendingNodes,
      matchDetails,
    };
  },

  /**
   * Recommend the next skill for a user to learn from a roadmap.
   * Traverses the roadmap DAG to find the optimal next learnable node.
   */
  async recommendNextSkill(
    userId: string,
    roadmapId: string,
  ): Promise<SkillRecommendation | null> {
    // 1. Get current progress
    const progress = await this.getUserRoadmapProgress(userId, roadmapId);

    // 2. If all nodes completed, nothing to recommend
    if (progress.pendingNodes.length === 0) {
      return null;
    }

    // 3. Fetch edges for DAG traversal
    const edges = await RoadmapEdgeModel.findByRoadmap(roadmapId);
    const nodes = await RoadmapNodeModel.findByRoadmap(roadmapId);

    // Build lookup map for nodes
    const nodeMap = new Map<string, RoadmapNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build completed set
    const completedIds = new Set(progress.completedNodes.map((n) => n.id));

    // Build prerequisite map (nodeId → prereq node IDs)
    const prereqMap = buildPrerequisiteMap(edges);

    // Build dependents map (nodeId → dependent node IDs)
    const dependentsMap = buildDependentsMap(edges);

    // 4. Find candidate nodes where ALL prerequisites are satisfied
    const pendingIds = new Set(progress.pendingNodes.map((n) => n.id));

    interface Candidate {
      node: RoadmapNode;
      satisfiedPrereqs: { id: string; title: string }[];
      dependentsCount: number;
    }

    const candidates: Candidate[] = [];

    for (const pendingId of pendingIds) {
      const node = nodeMap.get(pendingId);
      if (!node) continue;

      const prereqs = prereqMap.get(pendingId);
      const satisfiedPrereqs: { id: string; title: string }[] = [];
      let allSatisfied = true;

      if (prereqs && prereqs.size > 0) {
        for (const prereqId of prereqs) {
          if (completedIds.has(prereqId)) {
            const prereqNode = nodeMap.get(prereqId);
            satisfiedPrereqs.push({
              id: prereqId,
              title: prereqNode?.title ?? 'Unknown',
            });
          } else {
            allSatisfied = false;
            break;
          }
        }
      }

      if (allSatisfied) {
        const dependents = dependentsMap.get(pendingId);
        candidates.push({
          node,
          satisfiedPrereqs,
          dependentsCount: dependents ? dependents.size : 0,
        });
      }
    }

    // 5. If no candidates with satisfied prereqs, fall back to root nodes (no prereqs)
    if (candidates.length === 0) {
      // Find pending nodes that have no prerequisites at all
      for (const pendingId of pendingIds) {
        const node = nodeMap.get(pendingId);
        if (!node) continue;
        const prereqs = prereqMap.get(pendingId);
        if (!prereqs || prereqs.size === 0) {
          candidates.push({
            node,
            satisfiedPrereqs: [],
            dependentsCount: dependentsMap.get(pendingId)?.size ?? 0,
          });
        }
      }
    }

    // 6. If still no candidates, return first pending node
    if (candidates.length === 0) {
      const firstPending = progress.pendingNodes[0];
      const node = nodeMap.get(firstPending.id);
      if (!node) return null;

      return {
        recommendedNode: {
          id: node.id,
          title: node.title,
          slug: node.slug,
          description: node.description,
          type: node.type,
        },
        reason: 'Next sequential node in the roadmap (some prerequisites may still be pending)',
        prerequisitesSatisfied: [],
        estimatedProgressGain: Math.round((1 / progress.totalNodes) * 100),
        learningResources: node.description,
      };
    }

    // 7. Sort candidates by priority:
    //    1st: sort_order (sequential order)
    //    2nd: dependents count (unlock impact, DESC)
    //    3rd: position_y (visual order)
    candidates.sort((a, b) => {
      // Primary: sort_order ascending (sequential)
      if (a.node.sort_order !== b.node.sort_order) {
        return a.node.sort_order - b.node.sort_order;
      }
      // Secondary: more dependents = higher priority (descending)
      if (a.dependentsCount !== b.dependentsCount) {
        return b.dependentsCount - a.dependentsCount;
      }
      // Tertiary: position_y ascending
      return a.node.position_y - b.node.position_y;
    });

    const best = candidates[0];

    // 8. Determine reason
    let reason: string;
    if (best.satisfiedPrereqs.length > 0) {
      reason = `All ${best.satisfiedPrereqs.length} prerequisite(s) satisfied. `;
    } else {
      reason = 'No prerequisites required. ';
    }

    if (best.dependentsCount > 0) {
      reason += `Completing this unlocks ${best.dependentsCount} dependent node(s).`;
    } else {
      reason += 'Next sequential node in the roadmap.';
    }

    return {
      recommendedNode: {
        id: best.node.id,
        title: best.node.title,
        slug: best.node.slug,
        description: best.node.description,
        type: best.node.type,
      },
      reason: reason.trim(),
      prerequisitesSatisfied: best.satisfiedPrereqs,
      estimatedProgressGain: Math.round((1 / progress.totalNodes) * 100),
      learningResources: best.node.description,
    };
  },

  async generateRoadmapForSkills(missingSkills: string[]): Promise<{ roadmap: Array<{ week: number; topic: string; tasks: string[] }> }> {
    if (!missingSkills || missingSkills.length === 0) {
      return { roadmap: [] };
    }

    const roadmap = missingSkills.map((skill, index) => {
      return {
        week: index + 1,
        topic: `Mastering ${skill}`,
        tasks: [
          `Understand the core concepts of ${skill}`,
          `Complete an online tutorial or read documentation for ${skill}`,
          `Build a small practice project using ${skill}`,
          `Review advanced topics and best practices for ${skill}`
        ]
      };
    });

    return { roadmap };
  },
};

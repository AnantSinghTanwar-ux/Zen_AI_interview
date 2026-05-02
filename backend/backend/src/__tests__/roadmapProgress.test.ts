import {
  normalizeSkill,
  matchSkillToNode,
  findMatchedNodes,
  RoadmapProgressService,
} from '../services/roadmapProgress.service';
import { RoadmapNode } from '../models/roadmapNode.model';
import { RoadmapEdge } from '../models/roadmapEdge.model';

// ── Mock all DB models ──────────────────────────────────────────────────────────

jest.mock('../models/applicantProfile.model', () => ({
  ApplicantProfileModel: {
    findByUserId: jest.fn(),
  },
}));

jest.mock('../models/roadmap.model', () => ({
  RoadmapModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../models/roadmapNode.model', () => ({
  RoadmapNodeModel: {
    findByRoadmap: jest.fn(),
  },
}));

jest.mock('../models/roadmapEdge.model', () => ({
  RoadmapEdgeModel: {
    findByRoadmap: jest.fn(),
  },
}));

// Re-import mocked modules
import { ApplicantProfileModel } from '../models/applicantProfile.model';
import { RoadmapModel } from '../models/roadmap.model';
import { RoadmapNodeModel } from '../models/roadmapNode.model';
import { RoadmapEdgeModel } from '../models/roadmapEdge.model';

const mockApplicantProfile = ApplicantProfileModel as jest.Mocked<typeof ApplicantProfileModel>;
const mockRoadmap = RoadmapModel as jest.Mocked<typeof RoadmapModel>;
const mockRoadmapNode = RoadmapNodeModel as jest.Mocked<typeof RoadmapNodeModel>;
const mockRoadmapEdge = RoadmapEdgeModel as jest.Mocked<typeof RoadmapEdgeModel>;

// ── Helpers ─────────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<RoadmapNode> & { id: string; title: string }): RoadmapNode {
  return {
    roadmap_id: 'roadmap-1',
    slug: overrides.title.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    type: 'topic',
    parent_id: null,
    position_x: 0,
    position_y: 0,
    sort_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeEdge(
  source: string,
  target: string,
  roadmapId = 'roadmap-1',
): RoadmapEdge {
  return {
    id: `edge-${source}-${target}`,
    roadmap_id: roadmapId,
    source_node_id: source,
    target_node_id: target,
    created_at: new Date(),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('Skill Normalization', () => {
  it('should lowercase and trim', () => {
    expect(normalizeSkill('  React  ')).toBe('react');
  });

  it('should strip dots, dashes, underscores, hashes', () => {
    expect(normalizeSkill('React.js')).toBe('reactjs');
    expect(normalizeSkill('Node-JS')).toBe('nodejs');
    expect(normalizeSkill('C_Sharp')).toBe('csharp');
    expect(normalizeSkill('C#')).toBe('c');
  });

  it('should collapse whitespace', () => {
    expect(normalizeSkill('Node JS')).toBe('nodejs');
    expect(normalizeSkill('Vue  js')).toBe('vuejs');
  });

  it('should handle empty string', () => {
    expect(normalizeSkill('')).toBe('');
  });
});

describe('matchSkillToNode', () => {
  it('should return exact for identical strings', () => {
    expect(matchSkillToNode('React', 'React')).toBe('exact');
  });

  it('should return null for case-different exact but no normalized match', () => {
    expect(matchSkillToNode('Python', 'Java')).toBeNull();
  });

  it('should return normalized for case-insensitive match', () => {
    expect(matchSkillToNode('react', 'React')).toBe('normalized');
  });

  it('should return normalized for dot-stripped match', () => {
    expect(matchSkillToNode('React.js', 'ReactJS')).toBe('normalized');
  });

  it('should return normalized for whitespace-collapsed match', () => {
    expect(matchSkillToNode('Node JS', 'NodeJS')).toBe('normalized');
  });

  it('should return null when no match', () => {
    expect(matchSkillToNode('Python', 'JavaScript')).toBeNull();
  });
});

describe('findMatchedNodes', () => {
  const nodes: RoadmapNode[] = [
    makeNode({ id: '1', title: 'React' }),
    makeNode({ id: '2', title: 'Node.js', sort_order: 1 }),
    makeNode({ id: '3', title: 'PostgreSQL', sort_order: 2 }),
  ];

  it('should match exact and normalized skills', () => {
    const result = findMatchedNodes(['React', 'nodejs'], nodes);
    expect(result[0].matchType).toBe('exact');
    expect(result[0].matchedSkill).toBe('React');
    expect(result[1].matchType).toBe('normalized');
    expect(result[1].matchedSkill).toBe('nodejs');
    expect(result[2].matchType).toBeNull();
    expect(result[2].matchedSkill).toBeNull();
  });

  it('should return all unmatched when skills is empty', () => {
    const result = findMatchedNodes([], nodes);
    expect(result.every((r: any) => r.matchType === null)).toBe(true);
  });

  it('should return all unmatched when nodes is empty', () => {
    const result = findMatchedNodes(['React'], []);
    expect(result).toHaveLength(0);
  });

  it('should not duplicate matches — each node matched at most once', () => {
    const duplicateSkills = ['React', 'react', 'REACT'];
    const result = findMatchedNodes(duplicateSkills, nodes);
    const matched = result.filter((r: any) => r.matchType !== null);
    expect(matched).toHaveLength(1);
    expect(matched[0].matchType).toBe('exact');
    expect(matched[0].matchedSkill).toBe('React');
  });
});

describe('getUserRoadmapProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 404 if roadmap not found', async () => {
    mockRoadmap.findById.mockResolvedValue(null);

    await expect(
      RoadmapProgressService.getUserRoadmapProgress('user-1', 'nonexistent'),
    ).rejects.toThrow('Roadmap not found');
  });

  it('should return 0% when user has no skills', async () => {
    mockRoadmap.findById.mockResolvedValue({
      id: 'roadmap-1',
      slug: 'frontend',
      title: 'Frontend',
      description: null,
      source_url: null,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockApplicantProfile.findByUserId.mockResolvedValue(null);
    mockRoadmapNode.findByRoadmap.mockResolvedValue([
      makeNode({ id: '1', title: 'HTML' }),
      makeNode({ id: '2', title: 'CSS' }),
    ]);

    const result = await RoadmapProgressService.getUserRoadmapProgress('user-1', 'roadmap-1');

    expect(result.completionPercentage).toBe(0);
    expect(result.completedNodes).toHaveLength(0);
    expect(result.pendingNodes).toHaveLength(2);
    expect(result.totalNodes).toBe(2);
  });

  it('should return 100% when all skills match', async () => {
    mockRoadmap.findById.mockResolvedValue({
      id: 'roadmap-1',
      slug: 'frontend',
      title: 'Frontend',
      description: null,
      source_url: null,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockApplicantProfile.findByUserId.mockResolvedValue({
      user_id: 'user-1',
      skills: ['HTML', 'CSS'],
      name: null,
      phone: null,
      photo_url: null,
      experience: [],
      education: [], portfolio_url: null, github_url: null,
      linkedin_url: null,
      bio: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockRoadmapNode.findByRoadmap.mockResolvedValue([
      makeNode({ id: '1', title: 'HTML' }),
      makeNode({ id: '2', title: 'CSS' }),
    ]);

    const result = await RoadmapProgressService.getUserRoadmapProgress('user-1', 'roadmap-1');

    expect(result.completionPercentage).toBe(100);
    expect(result.completedNodes).toHaveLength(2);
    expect(result.pendingNodes).toHaveLength(0);
  });

  it('should return partial match percentage', async () => {
    mockRoadmap.findById.mockResolvedValue({
      id: 'roadmap-1',
      slug: 'frontend',
      title: 'Frontend',
      description: null,
      source_url: null,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockApplicantProfile.findByUserId.mockResolvedValue({
      user_id: 'user-1',
      skills: ['HTML'],
      name: null,
      phone: null,
      photo_url: null,
      experience: [],
      education: [], portfolio_url: null, github_url: null,
      linkedin_url: null,
      bio: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockRoadmapNode.findByRoadmap.mockResolvedValue([
      makeNode({ id: '1', title: 'HTML' }),
      makeNode({ id: '2', title: 'CSS' }),
      makeNode({ id: '3', title: 'JavaScript' }),
      makeNode({ id: '4', title: 'React' }),
    ]);

    const result = await RoadmapProgressService.getUserRoadmapProgress('user-1', 'roadmap-1');

    expect(result.completionPercentage).toBe(25); // 1/4
    expect(result.completedNodes).toHaveLength(1);
    expect(result.pendingNodes).toHaveLength(3);
  });

  it('should handle empty roadmap (no nodes)', async () => {
    mockRoadmap.findById.mockResolvedValue({
      id: 'roadmap-1',
      slug: 'empty',
      title: 'Empty',
      description: null,
      source_url: null,
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockApplicantProfile.findByUserId.mockResolvedValue(null);
    mockRoadmapNode.findByRoadmap.mockResolvedValue([]);

    const result = await RoadmapProgressService.getUserRoadmapProgress('user-1', 'roadmap-1');

    expect(result.completionPercentage).toBe(0);
    expect(result.totalNodes).toBe(0);
  });
});

describe('recommendNextSkill', () => {
  const roadmap = {
    id: 'roadmap-1',
    slug: 'frontend',
    title: 'Frontend',
    description: null,
    source_url: null,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoadmap.findById.mockResolvedValue(roadmap);
  });

  it('should return null when all nodes are completed', async () => {
    mockApplicantProfile.findByUserId.mockResolvedValue({
      user_id: 'user-1',
      skills: ['HTML', 'CSS'],
      name: null, phone: null, photo_url: null,
      experience: [], education: [], portfolio_url: null, github_url: null, linkedin_url: null,
      bio: null, created_at: new Date(), updated_at: new Date(),
    });
    mockRoadmapNode.findByRoadmap.mockResolvedValue([
      makeNode({ id: '1', title: 'HTML', sort_order: 0 }),
      makeNode({ id: '2', title: 'CSS', sort_order: 1 }),
    ]);
    mockRoadmapEdge.findByRoadmap.mockResolvedValue([]);

    const result = await RoadmapProgressService.recommendNextSkill('user-1', 'roadmap-1');
    expect(result).toBeNull();
  });

  it('should recommend next sequential node in a linear chain', async () => {
    // HTML → CSS → JavaScript (user knows HTML)
    const nodes = [
      makeNode({ id: '1', title: 'HTML', sort_order: 0 }),
      makeNode({ id: '2', title: 'CSS', sort_order: 1 }),
      makeNode({ id: '3', title: 'JavaScript', sort_order: 2 }),
    ];

    mockApplicantProfile.findByUserId.mockResolvedValue({
      user_id: 'user-1',
      skills: ['HTML'],
      name: null, phone: null, photo_url: null,
      experience: [], education: [], portfolio_url: null, github_url: null, linkedin_url: null,
      bio: null, created_at: new Date(), updated_at: new Date(),
    });
    mockRoadmapNode.findByRoadmap.mockResolvedValue(nodes);
    mockRoadmapEdge.findByRoadmap.mockResolvedValue([
      makeEdge('1', '2'),
      makeEdge('2', '3'),
    ]);

    const result = await RoadmapProgressService.recommendNextSkill('user-1', 'roadmap-1');

    expect(result).not.toBeNull();
    expect(result!.recommendedNode.title).toBe('CSS');
    expect(result!.estimatedProgressGain).toBe(33); // 1/3 ≈ 33%
  });

  it('should not recommend node with unsatisfied prerequisites', async () => {
    // HTML → CSS → JavaScript (user knows nothing)
    const nodes = [
      makeNode({ id: '1', title: 'HTML', sort_order: 0 }),
      makeNode({ id: '2', title: 'CSS', sort_order: 1 }),
      makeNode({ id: '3', title: 'JavaScript', sort_order: 2 }),
    ];

    mockApplicantProfile.findByUserId.mockResolvedValue({
      user_id: 'user-1',
      skills: [],
      name: null, phone: null, photo_url: null,
      experience: [], education: [], portfolio_url: null, github_url: null, linkedin_url: null,
      bio: null, created_at: new Date(), updated_at: new Date(),
    });
    mockRoadmapNode.findByRoadmap.mockResolvedValue(nodes);
    mockRoadmapEdge.findByRoadmap.mockResolvedValue([
      makeEdge('1', '2'),
      makeEdge('2', '3'),
    ]);

    const result = await RoadmapProgressService.recommendNextSkill('user-1', 'roadmap-1');

    // HTML has no prereqs so it should be recommended first
    expect(result).not.toBeNull();
    expect(result!.recommendedNode.title).toBe('HTML');
  });

  it('should prioritize node that unlocks more dependents', async () => {
    // A (completed) → B and A → C
    // B → D, B → E (B unlocks 2)
    // C has no dependents (C unlocks 0)
    // Both B and C have same sort_order=1
    const nodes = [
      makeNode({ id: 'a', title: 'A', sort_order: 0 }),
      makeNode({ id: 'b', title: 'B', sort_order: 1, position_y: 0 }),
      makeNode({ id: 'c', title: 'C', sort_order: 1, position_y: 1 }),
      makeNode({ id: 'd', title: 'D', sort_order: 2 }),
      makeNode({ id: 'e', title: 'E', sort_order: 2 }),
    ];

    mockApplicantProfile.findByUserId.mockResolvedValue({
      user_id: 'user-1',
      skills: ['A'],
      name: null, phone: null, photo_url: null,
      experience: [], education: [], portfolio_url: null, github_url: null, linkedin_url: null,
      bio: null, created_at: new Date(), updated_at: new Date(),
    });
    mockRoadmapNode.findByRoadmap.mockResolvedValue(nodes);
    mockRoadmapEdge.findByRoadmap.mockResolvedValue([
      makeEdge('a', 'b'),
      makeEdge('a', 'c'),
      makeEdge('b', 'd'),
      makeEdge('b', 'e'),
    ]);

    const result = await RoadmapProgressService.recommendNextSkill('user-1', 'roadmap-1');

    expect(result).not.toBeNull();
    expect(result!.recommendedNode.title).toBe('B'); // B unlocks 2 vs C unlocks 0
  });

  it('should handle empty roadmap', async () => {
    mockApplicantProfile.findByUserId.mockResolvedValue(null);
    mockRoadmapNode.findByRoadmap.mockResolvedValue([]);
    mockRoadmapEdge.findByRoadmap.mockResolvedValue([]);

    const result = await RoadmapProgressService.recommendNextSkill('user-1', 'roadmap-1');
    expect(result).toBeNull();
  });
});

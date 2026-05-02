-- Migration 004: Roadmap Ingestion System Tables
-- Creates roadmaps, roadmap_nodes, roadmap_edges, ingestion_runs

-- ─── Roadmaps ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roadmaps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(255) UNIQUE NOT NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  source_url  VARCHAR(1000),
  version     INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Roadmap Nodes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roadmap_nodes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roadmap_id  UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  slug        VARCHAR(500) NOT NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  type        VARCHAR(100) DEFAULT 'topic',
  parent_id   UUID REFERENCES roadmap_nodes(id) ON DELETE SET NULL,
  position_x  INTEGER DEFAULT 0,
  position_y  INTEGER DEFAULT 0,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (roadmap_id, slug)
);

-- ─── Roadmap Edges ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roadmap_edges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roadmap_id      UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  source_node_id  UUID NOT NULL REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
  target_node_id  UUID NOT NULL REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (roadmap_id, source_node_id, target_node_id)
);

-- ─── Ingestion Runs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        VARCHAR(255) NOT NULL DEFAULT 'github',
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  logs          JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_roadmap_nodes_roadmap ON roadmap_nodes (roadmap_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_nodes_parent  ON roadmap_nodes (parent_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_edges_roadmap ON roadmap_edges (roadmap_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_edges_source  ON roadmap_edges (source_node_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_edges_target  ON roadmap_edges (target_node_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON ingestion_runs (status);

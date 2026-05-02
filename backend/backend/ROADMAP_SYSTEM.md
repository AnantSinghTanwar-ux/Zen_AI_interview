# Roadmap Ingestion System

A complete system for fetching, parsing, and serving roadmap data from [roadmap.sh](https://roadmap.sh).

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│  Source      │────▶│   Parser     │────▶│  Ingestion   │────▶│ PostgreSQL │
│  Loader     │     │              │     │  Service     │     │            │
│ (Local /    │     │ (Flatten,    │     │ (Transact,   │     │ roadmaps   │
│  GitHub)    │     │  Dedup, DFS) │     │  Upsert)     │     │ nodes/edges│
└─────────────┘     └──────────────┘     └──────────────┘     └────────────┘
                                                                     │
                                                               ┌─────▼──────┐
                                                               │  REST API  │
                                                               │ /roadmaps  │
                                                               └────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL running locally
- Backend `.env` configured (see existing `.env`)

### 1. Run Database Migration

The migration runs automatically when you trigger ingestion, but you can also run it manually:

```bash
cd backend
dotenv -e .env -- psql -h localhost -U arnav -d hiring_platform -f src/config/migrations/004_create_roadmap_tables.sql
```

### 2. Run Ingestion

**Via CLI:**
```bash
# Full ingestion
npm run roadmap:ingest

# Dry run (parse only, no DB writes)
npm run roadmap:ingest -- --dry-run
```

**Via API:**
```bash
# Full ingestion
curl -X POST http://localhost:5001/api/v1/roadmaps/ingest \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

# Dry run
curl -X POST http://localhost:5001/api/v1/roadmaps/ingest \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

### 3. Query Roadmaps

```bash
# List all roadmaps (paginated)
curl http://localhost:5001/api/v1/roadmaps?page=1&limit=20

# Get single roadmap by slug
curl http://localhost:5001/api/v1/roadmaps/frontend

# Get roadmap nodes and edges
curl http://localhost:5001/api/v1/roadmaps/frontend/nodes
```

---

## API Reference

### `GET /api/v1/roadmaps`

List all roadmaps with node counts and pagination.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | query | 1 | Page number |
| `limit` | query | 20 | Items per page (max 100) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "frontend",
      "title": "Frontend Developer",
      "description": "...",
      "node_count": 45,
      "version": 1
    }
  ],
  "pagination": { "total": 46, "page": 1, "limit": 20, "totalPages": 3 }
}
```

### `GET /api/v1/roadmaps/:id`

Get a single roadmap by UUID or slug.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "frontend",
    "title": "Frontend Developer",
    "node_count": 45
  }
}
```

### `GET /api/v1/roadmaps/:id/nodes`

Get all nodes and edges for a roadmap.

**Response:**
```json
{
  "success": true,
  "data": {
    "roadmap": { "id": "uuid", "slug": "frontend", "title": "..." },
    "nodes": [
      { "id": "uuid", "slug": "html", "title": "HTML", "type": "topic", "parent_id": null }
    ],
    "edges": [
      { "id": "uuid", "source_node_id": "uuid-1", "target_node_id": "uuid-2" }
    ]
  }
}
```

### `POST /api/v1/roadmaps/ingest`

Trigger roadmap ingestion pipeline.

**Body:**
```json
{ "dryRun": false }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "uuid",
    "status": "completed",
    "totalRoadmaps": 46,
    "successCount": 44,
    "failCount": 2,
    "durationMs": 45000
  }
}
```

### `GET /api/v1/roadmaps/ingestion/:id`

Get ingestion run status and logs.

---

## Postman Collection

Import `roadmap-api-collection.json` from the backend root into Postman:

1. Open Postman → Import → Upload file
2. Select `backend/roadmap-api-collection.json`
3. Set the `baseUrl` variable to `http://localhost:5001/api/v1`
4. Run the collection — all tests should pass green

The collection includes 8 requests across 3 folders (Health, Ingestion, Roadmaps) with automated test scripts.

---

## Database Schema

| Table | Description |
|-------|-------------|
| `roadmaps` | Roadmap metadata (slug, title, description, version) |
| `roadmap_nodes` | Nodes within roadmaps (topics, categories) with hierarchy |
| `roadmap_edges` | Directed relationships between nodes |
| `ingestion_runs` | Ingestion execution history with logs |

### Idempotency

- Roadmaps are upserted by `slug` (unique constraint)
- Nodes are upserted by `(roadmap_id, slug)` (composite unique)
- Edges are upserted by `(roadmap_id, source_node_id, target_node_id)`
- Stale nodes/edges are automatically removed after each run
- Running ingestion multiple times is completely safe

---

## Project Structure

```
backend/src/
├── config/
│   └── migrations/
│       └── 004_create_roadmap_tables.sql   # Schema migration
├── models/
│   ├── roadmap.model.ts                    # Roadmap queries
│   ├── roadmapNode.model.ts                # Node queries
│   ├── roadmapEdge.model.ts                # Edge queries
│   └── ingestionRun.model.ts               # Run tracking
├── services/
│   ├── roadmapLoader.ts                    # Source data loader
│   ├── roadmapParser.ts                    # Data parser
│   └── ingestion.service.ts                # Pipeline orchestrator
├── controllers/
│   └── roadmap.controller.ts               # API handlers
├── routes/
│   └── roadmap.routes.ts                   # Route definitions
└── scripts/
    └── runIngestion.ts                     # CLI ingestion script
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tables don't exist | Run migration: `npm run roadmap:ingest` (auto-migrates) |
| GitHub rate limited | Use `ROADMAP_LOCAL_REPO_PATH` to load from a local clone |
| Ingestion timeout | Individual roadmap failures mark the run as failed so you can inspect logs |
| Duplicate data | Impossible — upserts + unique constraints enforce this |

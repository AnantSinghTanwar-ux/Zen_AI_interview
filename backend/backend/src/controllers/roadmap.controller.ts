import { Request, Response, NextFunction } from 'express';
import { RoadmapModel } from '../models/roadmap.model';
import { RoadmapNodeModel } from '../models/roadmapNode.model';
import { RoadmapEdgeModel } from '../models/roadmapEdge.model';
import { runFullIngestion, getIngestionRunStatus } from '../services/ingestion.service';
import { sendSuccess, sendPaginated, sendError } from '../utils/response';
import { RoadmapProgressService } from '../services/roadmapProgress.service';

/**
 * GET /roadmaps
 * Returns paginated list of all roadmaps with node count.
 */
export const listRoadmaps = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const { rows, total } = await RoadmapModel.findAll(page, limit);
    sendPaginated(res, rows, total, page, limit, 'Roadmaps retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /roadmaps/:id
 * Returns full roadmap metadata. Accepts UUID or slug.
 */
export const getRoadmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);

    // Try UUID first, then slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const roadmap = isUuid
      ? await RoadmapModel.findById(id)
      : await RoadmapModel.findBySlug(id);

    if (!roadmap) {
      return sendError(res, 'Roadmap not found', 404);
    }

    sendSuccess(res, roadmap, 'Roadmap retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /roadmaps/:id/nodes
 * Returns roadmap metadata with full node list and edge list.
 */
export const getRoadmapNodes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);

    // Resolve roadmap
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const roadmap = isUuid
      ? await RoadmapModel.findById(id)
      : await RoadmapModel.findBySlug(id);

    if (!roadmap) {
      return sendError(res, 'Roadmap not found', 404);
    }

    const [nodes, edges] = await Promise.all([
      RoadmapNodeModel.findByRoadmap(roadmap.id),
      RoadmapEdgeModel.findByRoadmap(roadmap.id),
    ]);

    sendSuccess(
      res,
      {
        roadmap,
        nodes,
        edges,
      },
      'Roadmap nodes and edges retrieved successfully',
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /roadmaps/ingest
 * Triggers roadmap ingestion pipeline. Accepts optional { dryRun: boolean }.
 */
export const triggerIngestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dryRun = req.body?.dryRun === true;

    // Run ingestion in a non-blocking way for the HTTP response
    // but we still await for the result in this case for simplicity
    const result = await runFullIngestion(dryRun);

    const statusCode = result.status === 'completed' ? 200 : 207;
    sendSuccess(res, result, `Ingestion ${result.status}`, statusCode);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /roadmaps/ingestion/:id
 * Returns ingestion run status and logs.
 */
export const getIngestionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const run = await getIngestionRunStatus(id);

    if (!run) {
      return sendError(res, 'Ingestion run not found', 404);
    }

    sendSuccess(res, run, 'Ingestion run retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /roadmaps/generate
 * Generates a structured roadmap based on missing skills.
 */
export const generateRoadmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { missingSkills } = req.body;
    const result = await RoadmapProgressService.generateRoadmapForSkills(missingSkills);
    sendSuccess(res, result, 'Roadmap generated successfully');
  } catch (err) {
    next(err);
  }
};

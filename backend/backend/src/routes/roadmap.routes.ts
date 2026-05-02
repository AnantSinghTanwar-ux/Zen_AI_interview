import { Router } from 'express';
import {
  listRoadmaps,
  getRoadmap,
  getRoadmapNodes,
  triggerIngestion,
  getIngestionStatus,
  generateRoadmap,
} from '../controllers/roadmap.controller';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

// Ingestion routes (must come before :id to avoid param conflict)
router.post('/ingest', triggerIngestion);
router.get('/ingestion/:id', getIngestionStatus);

// Generator route
router.post('/generate', body('missingSkills').isArray(), validate, generateRoadmap);

// Roadmap CRUD routes
router.get('/', listRoadmaps);
router.get('/:id', getRoadmap);
router.get('/:id/nodes', getRoadmapNodes);

export default router;

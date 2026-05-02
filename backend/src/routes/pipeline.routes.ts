import { Router } from 'express';
import { PipelineController } from '../controllers/pipeline.controller';
import { authenticate, authorize } from '../middleware/auth';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

// 4. Employer Pipeline Access Check enforced via authorize('recruiter') and service ownership checks

router.get(
  '/board/:jobId',
  authorize('recruiter', 'admin'),
  param('jobId').isUUID(),
  validate,
  PipelineController.getBoard
);

router.patch(
  '/move-stage',
  authorize('recruiter', 'admin'),
  body('jobId').isUUID(),
  body('candidateId').isUUID(),
  body('toStage').isIn([
    'applied',
    'in_review',
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected',
  ]),
  validate,
  PipelineController.moveStage
);

router.get(
  '/history/:candidateId/:jobId',
  authorize('recruiter', 'admin'),
  param('candidateId').isUUID(),
  param('jobId').isUUID(),
  validate,
  PipelineController.getHistory
);

export default router;

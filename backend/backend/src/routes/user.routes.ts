import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from '../controllers/user.controller';
import { ResumeController } from '../controllers/resume.controller';
import * as RoadmapProgressController from '../controllers/roadmapProgress.controller';
import { authenticate, authorize } from '../middleware/auth';
import { uploadResume, uploadImage } from '../middleware/upload';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

// ── Own profile ────────────────────────────────────────────────────────────────
router.get('/me', UserController.getMyProfile);

router.put(
  '/me',
  body('name').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('phone').optional({ nullable: true, checkFalsy: true }).isMobilePhone('any'),
  body('bio').optional({ nullable: true }).isString(),
  body('skills').optional().isArray(),
  body('experience').optional().isArray(),
  body('education').optional().isArray(),
  body('company_name').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body('industry').optional({ nullable: true, checkFalsy: true }).isString(),
  body('website').optional({ nullable: true, checkFalsy: true }).isURL(),
  validate,
  UserController.updateProfile,
);

// ── File uploads ───────────────────────────────────────────────────────────────
router.post(
  '/me/resume',
  authorize('applicant'),
  uploadResume.single('resume'),
  UserController.uploadResume,
);

router.post(
  '/me/resume-parse',
  authorize('applicant'),
  uploadResume.single('resume'),
  UserController.parseResume,
);

router.post('/me/photo', uploadImage.single('photo'), UserController.uploadPhoto);

// ── Resumes (applicant only) ────────────────────────────────────────────────
router.get('/me/resumes', authorize('applicant'), ResumeController.getMyResumes);
router.get(
  '/me/resumes/default',
  authorize('applicant'),
  ResumeController.getDefaultResume,
);
router.get('/me/resumes/:id', authorize('applicant'), ResumeController.getById);
router.patch(
  '/me/resumes/:id/set-default',
  authorize('applicant'),
  ResumeController.setDefault,
);
router.delete('/me/resumes/:id', authorize('applicant'), ResumeController.delete);
router.post(
  '/me/resume-score',
  authorize('applicant'),
  uploadResume.single('file'),
  body('jobDescription').isString(),
  body('resumeText').optional().isString(),
  body('resume_id').optional().isUUID(),
  validate,
  ResumeController.scoreATS
);

// ── Saved Jobs (applicant only) ───────────────────────────────────────────────
router.get('/me/saved-jobs', authorize('applicant'), UserController.getSavedJobs);
router.post('/me/saved-jobs/:jobId', authorize('applicant'), UserController.saveJob);
router.delete('/me/saved-jobs/:jobId', authorize('applicant'), UserController.unsaveJob);

// ── Roadmap Progress & Recommendations ────────────────────────────────────────
router.get('/:userId/roadmaps/:roadmapId/progress', RoadmapProgressController.getUserProgress);
router.get(
  '/:userId/roadmaps/:roadmapId/recommend-next-skill',
  RoadmapProgressController.getRecommendedNextSkill,
);

// ── Public profile ─────────────────────────────────────────────────────────────
router.get('/:userId', UserController.getPublicProfile);

export default router;

import { Router } from 'express';
import { body } from 'express-validator';
import { JobController } from '../controllers/job.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { requireCredits } from '../middleware/credit.middleware';
import { requireEmail } from '../middleware/requireEmail';
import { employerGuard } from '../middleware/employerGuard';
import { validate } from '../middleware/validate';
import { CREDIT_COSTS } from '../config/creditCosts';

const router = Router();

// Public
router.get('/', optionalAuth, JobController.getJobs);
router.get('/:id', optionalAuth, JobController.getJobById);
router.post('/match', body('userSkills').isArray(), body('jobSkills').isArray(), validate, JobController.getMatchScore);
router.post('/skill-gap', body('userSkills').isArray(), body('requiredSkills').isArray(), validate, JobController.getSkillGap);
router.post('/interview-questions', body('role').isString(), body('skills').isArray(), validate, JobController.generateInterviewQuestions);

// Close endpoint: bypass employerGuard since service validates ownership
// Uses: authenticate + authorize('recruiter')
router.patch('/:id/close', authenticate, requireEmail, authorize('recruiter'), JobController.closeJob);

// Recruiter-only management routes (with profile check).
// Order is important:
// 1) authenticate: token must be valid
// 2) requireEmail: user must have a real email
// 2) authorize('recruiter'): role must be recruiter
// 3) employerGuard: recruiter profile must exist in DB
router.use(authenticate, requireEmail, authorize('recruiter'), employerGuard);

router.get('/my/listings', JobController.myJobs);

router.post(
  '/',
  requireCredits(CREDIT_COSTS.POST_JOB),
  body('title').notEmpty().trim(),
  body('description').notEmpty(),
  body('location').optional().isString().trim(),
  body('salary_min').optional().isInt({ min: 0 }),
  body('salary_max')
    .optional()
    .isInt({ min: 0 })
    .custom((value, { req }) => {
      if (req.body.salary_min !== undefined && Number(value) < Number(req.body.salary_min)) {
        throw new Error('salary_max must be greater than or equal to salary_min');
      }
      return true;
    }),
  body('type').optional().isIn(['full-time', 'part-time', 'contract', 'remote', 'internship']),
  body('skills').optional().isArray().withMessage('skills must be an array'),
  body('skills.*').optional().isString().withMessage('Each skill must be a string'),
  body('application_questions').optional().isArray().withMessage('application_questions must be an array'),
  body('application_questions.*.label').optional().isString().trim().notEmpty(),
  body('application_questions.*.type').optional().isIn(['text', 'textarea', 'select', 'rating', 'link']),
  body('application_questions.*.required').optional().isBoolean(),
  body('application_questions.*.section').optional().isString().trim(),
  body('application_questions.*.placeholder').optional().isString(),
  body('application_questions.*.options').optional().isArray(),
  body('application_questions.*.options.*').optional().isString(),
  validate,
  JobController.createJob,
);

router.put(
  '/:id',
  body('title').optional().notEmpty().trim(),
  body('description').optional().notEmpty(),
  body('location').optional().isString().trim(),
  body('salary_min').optional().isInt({ min: 0 }).toInt(),
  body('salary_max')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .custom((value, { req }) => {
      if (req.body.salary_min !== undefined && Number(value) < Number(req.body.salary_min)) {
        throw new Error('salary_max must be greater than or equal to salary_min');
      }
      return true;
    }),
  body('type')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(['full-time', 'part-time', 'contract', 'remote', 'internship']),
  body('skills')
    .optional()
    .isArray()
    .withMessage('skills must be an array')
    .bail()
    .custom((skills) =>
      Array.isArray(skills) &&
      skills.every((skill) => typeof skill === 'string' && skill.trim().length > 0),
    )
    .withMessage('skills must contain non-empty strings only')
    .customSanitizer((skills) => skills.map((skill: string) => skill.trim())),
  body('application_questions').optional().isArray().withMessage('application_questions must be an array'),
  body('application_questions.*.label').optional().isString().trim().notEmpty(),
  body('application_questions.*.type').optional().isIn(['text', 'textarea', 'select', 'rating', 'link']),
  body('application_questions.*.required').optional().isBoolean(),
  body('application_questions.*.section').optional().isString().trim(),
  body('application_questions.*.placeholder').optional().isString(),
  body('application_questions.*.options').optional().isArray(),
  body('application_questions.*.options.*').optional().isString(),
  validate,
  JobController.updateJob,
);

router.patch('/:id/publish', requireCredits(CREDIT_COSTS.POST_JOB), JobController.publish);
router.delete('/:id', JobController.delete);

export default router;

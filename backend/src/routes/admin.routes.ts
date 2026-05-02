import { Router } from 'express';
import { body } from 'express-validator';
import { AdminController } from '../controllers/admin.controller';
import { JobController } from '../controllers/job.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate, authorize('admin'));

// ── Users ───────────────────────────────────────────────────────────────────────
router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.getUserById);

router.patch(
  '/users/:id/ban',
  body('reason').notEmpty().withMessage('Ban reason is required'),
  validate,
  AdminController.banUser,
);

router.patch('/users/:id/unban', AdminController.unbanUser);

router.delete(
  '/users/:id',
  body('reason').notEmpty().withMessage('Delete reason is required'),
  validate,
  AdminController.deleteUser,
);

// ── Jobs ─────────────────────────────────────────────────────────────────────────
router.get('/jobs', AdminController.listJobs);

router.post(
  '/jobs',
  body('title').notEmpty().trim().withMessage('title is required'),
  body('description').notEmpty().withMessage('description is required'),
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
  body('type').optional().isIn(['full-time', 'part-time', 'contract', 'remote', 'internship']),
  body('status').optional().isIn(['draft', 'active', 'closed']),
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
  body('company_id').optional().isUUID().withMessage('company_id must be a valid UUID'),
  body('company_name')
    .optional()
    .isString()
    .trim()
    .custom((value, { req }) => {
      if (!req.body.company_id && !String(value || '').trim()) {
        throw new Error('company_name is required when company_id is not provided');
      }
      return true;
    }),
  body('company_location')
    .optional()
    .isString()
    .trim()
    .custom((value, { req }) => {
      if (!req.body.company_id && !String(value || '').trim()) {
        throw new Error('company_location is required for external company jobs');
      }
      return true;
    }),
  body('company_logo').optional().isURL().withMessage('company_logo must be a valid URL'),
  body('company_website').optional().isURL().withMessage('company_website must be a valid URL'),
  validate,
  AdminController.createJob,
);

router.patch('/jobs/:id/close', body('reason').notEmpty(), validate, AdminController.closeJob);

router.patch('/jobs/:id/approve', JobController.approveJob);

router.delete('/jobs/:id', body('reason').notEmpty(), validate, AdminController.deleteJob);

// ── Credits ───────────────────────────────────────────────────────────────────────
router.get('/credits', AdminController.getAllTransactions);

router.post(
  '/credits/:id/adjust',
  body('amount')
    .isInt()
    .withMessage('Amount must be an integer (positive to add, negative to deduct)'),
  body('reason').notEmpty().withMessage('Reason is required'),
  validate,
  AdminController.adjustCredits,
);

// ── Recruiter Verification ─────────────────────────────────────────────────────
router.patch(
  '/recruiter/:id/verify',
  body('is_verified')
    .exists()
    .withMessage('is_verified is required')
    .isBoolean({ strict: true })
    .withMessage('is_verified must be a strict boolean')
    .toBoolean(),
  validate,
  AdminController.verifyRecruiter,
);

// ── Job Approval ────────────────────────────────────────────────────────────────
router.get('/jobs/pending-approval', AdminController.getPendingApprovalJobs);
router.patch('/jobs/:id/approve-job', AdminController.approveJob);
router.patch('/jobs/:id/reject-job', 
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  validate,
  AdminController.rejectJob
);
router.get('/jobs/:id', AdminController.getJobById);

// ── Metrics & Audit ────────────────────────────────────────────────────────────────
router.get('/metrics', AdminController.getMetrics);
router.get('/audit-log', AdminController.getAuditLog);

// ── Applications ───────────────────────────────────────────────────────────────
router.get('/applications', AdminController.listApplications);
router.get('/applications/:id', AdminController.getApplicationById);
router.patch(
  '/applications/:id/status',
  body('status').isIn([
    'applied',
    'in_review',
    'shortlisted',
    'interview',
    'offer',
    'hired',
    'rejected',
  ]),
  validate,
  AdminController.updateApplicationStatus
);

export default router;

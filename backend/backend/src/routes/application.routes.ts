import { Router } from 'express';
import { body } from 'express-validator';
import { ApplicationController } from '../controllers/application.controller';
import { authenticate, authorize } from '../middleware/auth';
import { requireCredits } from '../middleware/credit.middleware';
import { requireEmail } from '../middleware/requireEmail';
import { CREDIT_COSTS } from '../config/creditCosts';
import { employerGuard } from '../middleware/employerGuard';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate, requireEmail);

// Applicant: view own applications
router.get('/my', authorize('applicant'), ApplicationController.myApplications);

// Applicant: view applications with filters (status, jobTitle)
router.get('/my/filtered', authorize('applicant'), ApplicationController.myApplicationsFiltered);

// Applicant: get application statistics
router.get('/my/stats', authorize('applicant'), ApplicationController.getApplicationStats);

// Recruiter: view all applicants across all jobs.
// We require recruiter profile middleware here because downstream service
// logic assumes recruiter ownership context.
router.get(
  '/recruiter/applicants',
  authorize('recruiter'),
  employerGuard,
  ApplicationController.recruiterApplications,
);

// Recruiter: view all applicants with filters (status, jobTitle, applicantName)
router.get(
  '/recruiter/applicants/filtered',
  authorize('recruiter'),
  employerGuard,
  ApplicationController.recruiterApplicationsFiltered,
);

// Recruiter: get statistics for all applications.
// Keep this before '/recruiter/applicants/:id' to avoid treating 'stats' as an ID.
router.get(
  '/recruiter/applicants/stats',
  authorize('recruiter'),
  employerGuard,
  ApplicationController.recruiterApplicationsStats,
);

// Recruiter: view one application detail
router.get(
  '/recruiter/applicants/:id',
  authorize('recruiter'),
  employerGuard,
  ApplicationController.recruiterApplicationById,
);

// Applicant: check if applied to a job
router.get('/jobs/:jobId/check', authorize('applicant'), ApplicationController.checkApplication);

// Applicant: apply to a job
router.post(
  '/jobs/:jobId',
  authorize('applicant'),
  requireCredits(CREDIT_COSTS.APPLY_JOB),
  body('cover_letter').optional().isString(),
  body('resume_id').notEmpty().withMessage('resume_id is required').isUUID().withMessage('resume_id must be a valid UUID'),
  body('answers').optional().isArray().withMessage('answers must be an array'),
  body('answers.*.question_id').optional().isString().trim().notEmpty(),
  body('answers.*.answer').optional().isString(),
  validate,
  ApplicationController.apply,
);

// Recruiter: view applications for a job
router.get('/jobs/:jobId', authorize('recruiter'), employerGuard, ApplicationController.jobApplications);

// Recruiter: update application status
router.patch(
  '/:id/status',
  // Middleware order matters: auth -> role -> profile -> validation -> controller.
  authorize('recruiter'),
  employerGuard,
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
  ApplicationController.updateStatus,
);

// Any role: get pipeline events for an application
router.get(
  '/:id/events',
  authorize('applicant', 'recruiter', 'admin'),
  ApplicationController.getEvents,
);

export default router;

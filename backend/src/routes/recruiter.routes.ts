import { Router } from 'express';
import { body } from 'express-validator';
import { RecruiterController } from '../controllers/recruiter.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { employerGuard } from '../middleware/employerGuard';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * GET /api/v1/recruiter/profile
 * Fetch authenticated recruiter's profile
 * 
 * Middleware: authenticate → authorize('recruiter') → employerGuard
 * Note: employerGuard pre-loads profile into req.employer, no DB query in controller
 */
router.get(
  '/profile',
  authenticate,
  authorize('recruiter'),
  employerGuard,
  RecruiterController.getRecruiterProfile,
);

/**
 * PUT /api/v1/recruiter/profile
 * Update recruiter profile (partial update allowed)
 * 
 * Middleware: authenticate → authorize('recruiter') → employerGuard → validate
 * Validation: all fields optional, but if provided must be valid
 * 
 * Updatable fields:
 * {
 *   "company_name": "string (optional)",
 *   "company_email": "string (optional, valid email)",
 *   "industry": "string (optional)",
 *   "description": "string (optional)",
 *   "company_size": "string (optional)",
 *   "website": "string (optional)",
 *   "location": "string (optional)",
 *   "logo_url": "string (optional)"
 * }
 * 
 * Non-updatable fields: id, user_id, is_verified, created_at, updated_at
 */
router.put(
  '/profile',
  authenticate,
  authorize('recruiter'),
  employerGuard,
  body('company_name').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Company name cannot be empty'),
  body('company_email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Company email must be a valid email address')
    .normalizeEmail(),
  body('industry').optional({ checkFalsy: true }).trim().isString(),
  body('description').optional({ checkFalsy: true }).trim().isString(),
  body('company_size').optional({ checkFalsy: true }).trim().isString(),
  body('website').optional({ checkFalsy: true }).trim().isString(),
  body('location').optional({ checkFalsy: true }).trim().isString(),
  body('logo_url').optional({ checkFalsy: true }).trim().isString(),
  validate,
  RecruiterController.updateRecruiterProfile,
);

/**
 * POST /api/v1/recruiter/profile
 * Create recruiter profile (first-time registration)
 * 
 * Middleware: authenticate → authorize('recruiter') → validate
 * Validation: company_name (required), company_email (optional, valid email)
 * 
 * Request body:
 * {
 *   "company_name": "string (required)",
 *   "company_email": "string (optional, valid email)",
 *   "industry": "string (optional)",
 *   "description": "string (optional)",
 *   "company_size": "string (optional)",
 *   "website": "string (optional)",
 *   "location": "string (optional)"
 * }
 */
router.post(
  '/profile',
  authenticate,
  authorize('recruiter'),
  body('company_name').trim().notEmpty().withMessage('Company name is required'),
  body('company_email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Company email must be a valid email address')
    .normalizeEmail(),
  body('industry').optional({ checkFalsy: true }).trim().isString(),
  body('description').optional({ checkFalsy: true }).trim().isString(),
  body('company_size').optional({ checkFalsy: true }).trim().isString(),
  body('website').optional({ checkFalsy: true }).trim().isString(),
  body('location').optional({ checkFalsy: true }).trim().isString(),
  validate,
  RecruiterController.createRecruiterProfile,
);

export default router;

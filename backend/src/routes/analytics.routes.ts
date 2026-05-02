import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth';
import { employerGuard } from '../middleware/employerGuard';

const router = Router();

// Analytics endpoints are recruiter-owned metrics.
// Order is fixed to avoid invalid context reaching controllers/services.
router.use(authenticate, authorize('recruiter'), employerGuard);

router.get('/summary', AnalyticsController.getSummary);
router.get('/applications-by-day', AnalyticsController.getApplicationsByDay);
router.get('/time-to-hire', AnalyticsController.getTimeToHire);
router.get('/credit-usage', AnalyticsController.getCreditUsage);
router.get('/jobs/:jobId/funnel', AnalyticsController.getJobFunnel);
router.get('/jobs/:jobId/views', AnalyticsController.getJobViews);

export default router;

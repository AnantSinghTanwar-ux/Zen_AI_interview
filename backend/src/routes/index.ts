import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import jobRoutes from './job.routes';
import applicationRoutes from './application.routes';
import creditRoutes from './credit.routes';
import notificationRoutes from './notification.routes';
import messageRoutes from './message.routes';
import paymentRoutes from './payment.routes';
import referralRoutes from './referral.routes';
import adminRoutes from './admin.routes';
import analyticsRoutes from './analytics.routes';
import pipelineRoutes from './pipeline.routes';
import recruiterRoutes from './recruiter.routes';
import roadmapRoutes from './roadmap.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/credits', creditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/payments', paymentRoutes);
router.use('/referrals', referralRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/pipeline', pipelineRoutes);
router.use('/recruiter', recruiterRoutes);
router.use('/roadmaps', roadmapRoutes);
router.use('/upload', uploadRoutes);

export default router;


import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/response';

export const AnalyticsController = {
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const [summary, topJobs] = await Promise.all([
        AnalyticsService.getRecruiterSummary(req.user!.userId),
        AnalyticsService.getTopJobs(req.user!.userId),
      ]);
      sendSuccess(res, { summary, top_jobs: topJobs });
    } catch (err) {
      next(err);
    }
  },

  async getApplicationsByDay(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await AnalyticsService.getApplicationsByDay(req.user!.userId, days);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getJobFunnel(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsService.getApplicationFunnel(
        req.user!.userId,
        req.params.jobId as string,
      );
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getJobViews(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsService.getJobViews(req.user!.userId, req.params.jobId as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getTimeToHire(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsService.getTimeToHire(req.user!.userId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getCreditUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await AnalyticsService.getCreditUsage(req.user!.userId, days);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
};

import { Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../services/application.service';
import { sendSuccess, sendPaginated } from '../utils/response';

export const ApplicationController = {
  async apply(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await ApplicationService.apply(
        req.user!.userId,
        req.params.jobId as string,
        req.body,
      );
      sendSuccess(res, application, 'Application submitted', 201);
    } catch (err) {
      next(err);
    }
  },

  async checkApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ApplicationService.checkApplied(
        req.user!.userId,
        req.params.jobId as string,
      );
      sendSuccess(res, result, 'Application check completed');
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const normalizedStatus = String(req.body.status || '').toLowerCase();
      const application = await ApplicationService.updateStatus(
        req.user!,
        req.params.id as string,
        normalizedStatus as any,
      );
      sendSuccess(res, application, 'Status updated');
    } catch (err) {
      next(err);
    }
  },

  async recruiterApplicationById(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await ApplicationService.getRecruiterApplicationDetail(
        req.user!.userId,
        req.params.id as string,
      );
      sendSuccess(res, application, 'Application detail');
    } catch (err) {
      next(err);
    }
  },

  async myApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { applications, total } = await ApplicationService.getMyApplications(
        req.user!.userId,
        page,
        limit,
      );
      sendPaginated(res, applications, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async jobApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 20;
      const { applications, total } = await ApplicationService.getJobApplications(
        req.user!.userId,
        req.params.jobId as string,
        page,
        limit,
      );
      sendPaginated(res, applications, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async myApplicationsFiltered(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const jobTitle = req.query.jobTitle as string | undefined;

      const { applications, total } = await ApplicationService.getMyApplicationsWithFilters(
        req.user!.userId,
        { status: status as any, jobTitle },
        page,
        limit,
      );
      sendPaginated(res, applications, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async getApplicationStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await ApplicationService.getApplicationStatistics(req.user!.userId);
      res.json({
        success: true,
        data: stats,
        message: 'Application statistics',
      });
    } catch (err) {
      next(err);
    }
  },

  async recruiterApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 20;
      const { applications, total } = await ApplicationService.getRecruiterApplications(
        req.user!.userId,
        page,
        limit,
      );
      sendPaginated(res, applications, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async recruiterApplicationsFiltered(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const jobTitle = req.query.jobTitle as string | undefined;
      const applicantName = req.query.applicantName as string | undefined;
      const jobId = req.query.jobId as string | undefined;
      const search = req.query.search as string | undefined;

      const { applications, total } = await ApplicationService.getRecruiterApplicationsWithFilters(
        req.user!.userId,
        { status: status as any, jobTitle, applicantName, jobId, search },
        page,
        limit,
      );
      sendPaginated(res, applications, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async recruiterApplicationsStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await ApplicationService.getRecruiterApplicationsStatistics(req.user!.userId);
      res.json({
        success: true,
        data: stats,
        message: 'Recruiter applications statistics',
      });
    } catch (err) {
      next(err);
    }
  },

  async getEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await ApplicationService.getEvents(req.user!, req.params.id as string);
      sendSuccess(res, events, 'Pipeline events retrieved');
    } catch (err) {
      next(err);
    }
  },
};

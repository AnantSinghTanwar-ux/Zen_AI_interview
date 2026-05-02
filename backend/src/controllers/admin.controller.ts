import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { sendSuccess, sendPaginated } from '../utils/response';

export const AdminController = {
  // ── Users ────────────────────────────────────────────────────────────────────
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { users, total } = await AdminService.listUsers({
        search: req.query.search as string,
        role: req.query.role as string,
        page,
        limit,
      });
      sendPaginated(res, users, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AdminService.getUserById(req.params.id as string);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },

  async banUser(req: Request, res: Response, next: NextFunction) {
    try {
      await AdminService.banUser(req.user!.userId, req.params.id as string, req.body.reason);
      sendSuccess(res, null, 'User banned');
    } catch (err) {
      next(err);
    }
  },

  async unbanUser(req: Request, res: Response, next: NextFunction) {
    try {
      await AdminService.unbanUser(req.user!.userId, req.params.id as string, req.body.reason);
      sendSuccess(res, null, 'User unbanned');
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      await AdminService.deleteUser(req.user!.userId, req.params.id as string, req.body.reason);
      sendSuccess(res, null, 'User deleted');
    } catch (err) {
      next(err);
    }
  },

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  async listJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { jobs, total } = await AdminService.listJobs({
        status: req.query.status as string,
        search: req.query.search as string,
        page,
        limit,
      });
      sendPaginated(res, jobs, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async createJob(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await AdminService.createJob(req.user!.userId, req.body);
      sendSuccess(res, job, 'Job created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async getJobById(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await AdminService.getJobById(req.params.id as string);
      sendSuccess(res, job);
    } catch (err) {
      next(err);
    }
  },

  async closeJob(req: Request, res: Response, next: NextFunction) {
    try {
      await AdminService.closeJob(req.user!.userId, req.params.id as string, req.body.reason);
      sendSuccess(res, null, 'Job closed');
    } catch (err) {
      next(err);
    }
  },

  async deleteJob(req: Request, res: Response, next: NextFunction) {
    try {
      await AdminService.deleteJob(req.user!.userId, req.params.id as string, req.body.reason);
      sendSuccess(res, null, 'Job deleted');
    } catch (err) {
      next(err);
    }
  },

  // ── Credits ──────────────────────────────────────────────────────────────────
  async getAllTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { transactions, total } = await AdminService.getAllTransactions(page, limit);
      sendPaginated(res, transactions, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async adjustCredits(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, reason } = req.body;
      await AdminService.adjustCredits(req.user!.userId, req.params.id as string, amount, reason);
      sendSuccess(res, null, 'Credits adjusted');
    } catch (err) {
      next(err);
    }
  },

  async verifyRecruiter(req: Request, res: Response, next: NextFunction) {
    try {
      const recruiterProfileId = req.params.id as string;
      const { is_verified } = req.body as { is_verified: boolean };
      const adminId = req.user!.userId;

      const updatedProfile = await AdminService.verifyRecruiterProfile(
        recruiterProfileId,
        is_verified,
        adminId,
      );

      sendSuccess(
        res,
        updatedProfile,
        'Recruiter verification status updated successfully',
        200,
      );
    } catch (err) {
      next(err);
    }
  },

  // ── Metrics ──────────────────────────────────────────────────────────────────
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const [metrics, dailyStats] = await Promise.all([
        AdminService.getPlatformMetrics(),
        AdminService.getDailyStats(30),
      ]);
      sendSuccess(res, { metrics, daily_stats: dailyStats });
    } catch (err) {
      next(err);
    }
  },

  // ── Audit Log ─────────────────────────────────────────────────────────────────
  async getAuditLog(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const { logs, total } = await AdminService.getAuditLog(page, limit);
      sendPaginated(res, logs, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  // ── Job Approval ────────────────────────────────────────────────────────────────
  async getPendingApprovalJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const { jobs, total } = await AdminService.getPendingApprovalJobs(page, limit, search);
      sendPaginated(res, jobs, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async approveJob(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await AdminService.approveJob(req.user!.userId, req.params.id as string);
      sendSuccess(res, job, 'Job approved successfully');
    } catch (err) {
      next(err);
    }
  },

  async rejectJob(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body as { reason: string };
      if (!reason?.trim()) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }
      const job = await AdminService.rejectJob(req.user!.userId, req.params.id as string, reason);
      sendSuccess(res, job, 'Job rejected');
    } catch (err) {
      next(err);
    }
  },

  // ── Applications ─────────────────────────────────────────────────────────────

  async listApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string,
        jobTitle: req.query.jobTitle as string,
        applicantName: req.query.applicantName as string,
        jobId: req.query.jobId as string,
        search: req.query.search as string,
      };
      const { applications, total } = await AdminService.listApplications(filters, page, limit);
      sendPaginated(res, applications, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  async getApplicationById(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await AdminService.getApplicationById(req.params.id as string);
      sendSuccess(res, application);
    } catch (err) {
      next(err);
    }
  },

  async updateApplicationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const updated = await AdminService.updateApplicationStatus(
        req.user!.userId,
        req.params.id as string,
        status
      );
      sendSuccess(res, updated, 'Application status updated');
    } catch (err) {
      next(err);
    }
  },
};

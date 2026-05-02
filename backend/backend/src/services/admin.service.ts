import { UserModel } from '../models/user.model';
import { JobModel, normalizeQuestions } from '../models/job.model';
import { CreditModel } from '../models/credit.model';
import { AdminAuditLogModel } from '../models/adminAuditLog.model';
import { NotificationModel } from '../models/notification.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { CreditService } from './credit.service';
import { NotificationService } from './notification.service';
import { AppError } from '../utils/appError';
import prisma from '../config/prisma';
import pool from '../config/database';
import { PoolClient } from 'pg';
import { ApplicationModel } from '../models/application.model';
import { ApplicationService } from './application.service';
import logger from '../config/logger';
export const AdminService = {
  // ── Users ───────────────────────────────────────────────────────────────────

  async listUsers(filters: { search?: string; role?: string; page: number; limit: number }) {
    return UserModel.adminList({
      search: filters.search,
      role: filters.role as 'applicant' | 'recruiter' | 'admin' | undefined,
      page: filters.page,
      limit: filters.limit,
    });
  },

  async getUserById(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  async banUser(adminId: string, userId: string, reason: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.banned_at) throw new AppError('User is already banned', 400);

    await UserModel.ban(userId);
    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'BAN_USER',
      target_type: 'user',
      target_id: userId,
      reason,
    });
  },

  async unbanUser(adminId: string, userId: string, reason?: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (!user.banned_at) throw new AppError('User is not banned', 400);

    await UserModel.unban(userId);
    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'UNBAN_USER',
      target_type: 'user',
      target_id: userId,
      reason,
    });
  },

  async deleteUser(adminId: string, userId: string, reason: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'DELETE_USER',
      target_type: 'user',
      target_id: userId,
      reason,
    });
  },

  // ── Jobs ─────────────────────────────────────────────────────────────────────

  async listJobs(filters: { status?: string; search?: string; page: number; limit: number }) {
    return JobModel.adminList(filters);
  },

  async getJobById(jobId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    return job;
  },

  async closeJob(adminId: string, jobId: string, reason: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);

    await JobModel.update(jobId, { status: 'closed' });
    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'CLOSE_JOB',
      target_type: 'job',
      target_id: jobId,
      reason,
    });
  },

  async deleteJob(adminId: string, jobId: string, reason: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);

    await JobModel.softDelete(jobId);
    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'DELETE_JOB',
      target_type: 'job',
      target_id: jobId,
      reason,
    });
  },

  async createJob(
    adminId: string,
    data: {
      title: string;
      description: string;
      type?: 'full-time' | 'part-time' | 'contract' | 'remote' | 'internship';
      location?: string;
      salary_min?: number;
      salary_max?: number;
      skills?: string[];
      status?: 'draft' | 'active' | 'closed';
      company_id?: string;
      company_name?: string;
      company_logo?: string;
      company_website?: string;
      company_location?: string;
      application_questions?: Array<{
        id?: string;
        label: string;
        type?: string;
        required?: boolean;
        section?: string;
        placeholder?: string;
        options?: string[];
      }>;
    },
  ) {
    if (!data.company_id && !data.company_name?.trim()) {
      throw new AppError('COMPANY_REQUIRED', 400, 'COMPANY_REQUIRED');
    }

    if (!data.company_id && !data.company_location?.trim()) {
      throw new AppError('External company requires company_location', 400, 'COMPANY_REQUIRED');
    }

    const job = await JobModel.createByAdmin({
      admin_id: adminId,
      title: data.title,
      description: data.description,
      type: data.type,
      location: data.location,
      salary_min: data.salary_min,
      salary_max: data.salary_max,
      skills: data.skills,
      status: data.status,
      company_id: data.company_id,
      company_name: data.company_name,
      company_logo: data.company_logo,
      company_website: data.company_website,
      company_location: data.company_location,
      application_questions: normalizeQuestions(data.application_questions),
    });

    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'CREATE_JOB',
      target_type: 'job',
      target_id: job.id,
      reason: job.is_external_company
        ? `Admin created external job for ${job.company.name}`
        : `Admin created job for company ${job.company.name}`,
    });

    if (job.is_external_company) {
      logger.info('Admin created external job', {
        adminId,
        companyName: job.company.name,
        jobId: job.id,
      });
    }

    return job;
  },

  // ── Credits ──────────────────────────────────────────────────────────────────

  async getAllTransactions(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM credit_transactions'),
      pool.query(
        `SELECT ct.*, u.email FROM credit_transactions ct
         JOIN users u ON u.id = ct.user_id
         ORDER BY ct.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);
    return { transactions: dataRes.rows, total: parseInt(countRes.rows[0].count) };
  },

  async adjustCredits(adminId: string, userId: string, amount: number, reason: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const description = `Admin adjustment: ${reason}`;
    if (amount > 0) {
      await CreditService.addCredits(userId, amount, description, adminId);
    } else {
      await CreditService.deductCredits(userId, Math.abs(amount), description, adminId);
    }

    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'ADJUST_CREDITS',
      target_type: 'user',
      target_id: userId,
      reason: `Amount: ${amount}, Reason: ${reason}`,
    });

    await NotificationModel.create({
      user_id: userId,
      type: amount > 0 ? 'payment_success' : 'low_credit',
      title: 'Credit balance adjusted',
      body: `An admin has ${amount > 0 ? 'added' : 'deducted'} ${Math.abs(amount)} credits. Reason: ${reason}`,
      action_url: '/credits',
    });
  },

  async verifyRecruiterProfile(
    profileId: string,
    isVerified: boolean,
    adminId: string,
  ): Promise<RecruiterProfile> {
    const existingProfile = await (prisma.recruiter_profiles as any).findFirst({
      where: { id: profileId },
    });

    if (!existingProfile) {
      throw new AppError('Recruiter profile not found', 404);
    }

    if (existingProfile.is_verified === isVerified) {
      return existingProfile as unknown as RecruiterProfile;
    }

    const updatedProfile = await (prisma.recruiter_profiles as any).update({
      where: { id: profileId },
      data: { is_verified: isVerified },
    });

    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: isVerified ? 'VERIFY_RECRUITER' : 'UNVERIFY_RECRUITER',
      target_type: 'recruiter_profile',
      target_id: profileId,
      reason: `Verification set to ${isVerified}`,
    });

    return updatedProfile as unknown as RecruiterProfile;
  },

  // ── Metrics ──────────────────────────────────────────────────────────────────

  async getPlatformMetrics() {
    return UserModel.getPlatformMetrics();
  },

  async getDailyStats(days = 30) {
    const safeDays = Math.max(1, Math.min(365, Number(days) || 30));
    const { rows } = await pool.query(
      `WITH day_series AS (
         SELECT generate_series(
           CURRENT_DATE - ($1::int - 1),
           CURRENT_DATE,
           INTERVAL '1 day'
         )::date AS day
       ),
       users_daily AS (
         SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM users
         WHERE created_at >= CURRENT_DATE - ($1::int - 1)
         GROUP BY DATE(created_at)
       ),
       jobs_daily AS (
         SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM jobs
         WHERE created_at >= CURRENT_DATE - ($1::int - 1)
           AND deleted_at IS NULL
         GROUP BY DATE(created_at)
       ),
       applications_daily AS (
         SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM applications
         WHERE created_at >= CURRENT_DATE - ($1::int - 1)
         GROUP BY DATE(created_at)
       )
       SELECT
         ds.day AS date,
         COALESCE(ud.count, 0)::int AS new_users,
         COALESCE(jd.count, 0)::int AS new_jobs,
         COALESCE(ad.count, 0)::int AS new_applications
       FROM day_series ds
       LEFT JOIN users_daily ud ON ud.day = ds.day
       LEFT JOIN jobs_daily jd ON jd.day = ds.day
       LEFT JOIN applications_daily ad ON ad.day = ds.day
       ORDER BY ds.day ASC`,
      [safeDays],
    );
    return rows;
  },

  // ── Audit Log ─────────────────────────────────────────────────────────────────

  async getAuditLog(page: number, limit: number) {
    return AdminAuditLogModel.findAll(page, limit);
  },

  // ── Job Approval ───────────────────────────────────────────────────────────────

  async getPendingApprovalJobs(page: number, limit: number, search?: string) {
    return JobModel.getPendingApprovalJobs({
      page,
      limit,
      search,
    });
  },

  async approveJob(adminId: string, jobId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);

    if (job.source === 'recruiter') {
      try {
        await CreditService.deductJobPostingCredits(job.recruiter_id);
      } catch {
        throw new AppError('Cannot approve job: recruiter has insufficient credits', 422);
      }
    }

    const approvedJob = await JobModel.approveJobByAdmin(jobId, adminId);

    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'APPROVE_JOB',
      target_type: 'job',
      target_id: jobId,
      reason: `Approved job: ${job.title}`,
    });

    await NotificationService.send(
      job.recruiter_id,
      'application_status',
      'Job approved',
      `Your job "${job.title}" has been approved and is now visible to applicants.`,
      `/recruiter/jobs/${jobId}`,
    );

    return approvedJob;
  },

  async rejectJob(adminId: string, jobId: string, reason: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);

    const rejectedJob = await JobModel.rejectJobByAdmin(jobId, adminId);

    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'REJECT_JOB',
      target_type: 'job',
      target_id: jobId,
      reason: `Rejected job: ${job.title}. Reason: ${reason}`,
    });

    await NotificationService.send(
      job.recruiter_id,
      'application_status',
      'Job rejected',
      `Your job "${job.title}" was rejected by admin. Reason: ${reason}`,
      `/recruiter/jobs/${jobId}`,
    );

    return rejectedJob;
  },

  // ── Applications ─────────────────────────────────────────────────────────────

  async listApplications(
    filters: { status?: string; jobTitle?: string; applicantName?: string; jobId?: string; search?: string },
    page: number,
    limit: number,
  ) {
    return ApplicationModel.adminFindAllWithFilters(
      {
        status: filters.status as any,
        jobTitle: filters.jobTitle,
        applicantName: filters.applicantName,
        jobId: filters.jobId,
        search: filters.search,
      },
      page,
      limit,
    );
  },

  async getApplicationById(applicationId: string) {
    const application = await ApplicationModel.adminFindById(applicationId);
    if (!application) throw new AppError('Application not found', 404);
    return application;
  },

  async updateApplicationStatus(adminId: string, applicationId: string, status: string) {
    const updated = await ApplicationService.updateStatus(
      { userId: adminId, role: 'admin' },
      applicationId,
      status as any,
    );

    await AdminAuditLogModel.create({
      admin_id: adminId,
      action: 'UPDATE_APPLICATION_STATUS',
      target_type: 'application',
      target_id: applicationId,
      reason: `Admin updated status to ${status}`,
    });

    return updated;
  },
};

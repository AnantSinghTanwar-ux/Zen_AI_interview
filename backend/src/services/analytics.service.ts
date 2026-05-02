import pool from '../config/database';
import { JobModel } from '../models/job.model';
import { AppError } from '../utils/appError';

export const AnalyticsService = {
  async getJobViews(recruiterId: string, jobId: string, days = 30) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    if (job.recruiter_id !== recruiterId) throw new AppError('Forbidden', 403);

    // We track total views on the jobs table; for time-series, return current total
    return { job_id: jobId, title: job.title, total_views: job.views_count };
  },

  async getApplicationFunnel(recruiterId: string, jobId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    if (job.recruiter_id !== recruiterId) throw new AppError('Forbidden', 403);

    const { rows } = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM applications WHERE job_id = $1
       GROUP BY status`,
      [jobId],
    );

    const statusOrder = [
      'applied',
      'in_review',
      'shortlisted',
      'interview',
      'offer',
      'hired',
      'rejected',
    ];
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      map[r.status] = r.count;
    });

    return {
      job_id: jobId,
      title: job.title,
      funnel: statusOrder.map((s) => ({ status: s, count: map[s] || 0 })),
    };
  },

  async getApplicationsByDay(recruiterId: string, days = 30) {
    const { rows } = await pool.query(
      `SELECT DATE(a.created_at) AS date, COUNT(*)::int AS count
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.recruiter_id = $1 AND a.created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(a.created_at)
       ORDER BY date ASC`,
      [recruiterId],
    );
    return rows;
  },

  async getTimeToHire(recruiterId: string) {
    const { rows } = await pool.query(
      `SELECT j.title, j.id,
         AVG(EXTRACT(EPOCH FROM (a.status_updated_at - a.created_at)) / 86400)::numeric(10,1) AS avg_days_to_hire
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.recruiter_id = $1 AND a.status = 'hired'
       GROUP BY j.id, j.title
       ORDER BY avg_days_to_hire ASC`,
      [recruiterId],
    );
    return rows;
  },

  async getCreditUsage(recruiterId: string, days = 30) {
    const { rows } = await pool.query(
      `SELECT DATE(created_at) AS date, SUM(amount)::int AS credits_spent
       FROM credit_transactions
       WHERE user_id = $1 AND type = 'debit'
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [recruiterId],
    );
    return rows;
  },

  async getRecruiterSummary(recruiterId: string) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM jobs WHERE recruiter_id = $1 AND deleted_at IS NULL)::int AS total_jobs,
         (SELECT COUNT(*) FROM jobs WHERE recruiter_id = $1 AND status = 'active' AND deleted_at IS NULL)::int AS active_jobs,
         (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.recruiter_id = $1)::int AS total_applications,
         (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.recruiter_id = $1 AND a.status = 'hired')::int AS total_hired,
         (SELECT SUM(views_count) FROM jobs WHERE recruiter_id = $1 AND deleted_at IS NULL)::int AS total_views
       FROM (SELECT 1) t`,
      [recruiterId],
    );
    return rows[0];
  },

  async getTopJobs(recruiterId: string) {
    const { rows } = await pool.query(
      `SELECT j.id, j.title, j.views_count, j.status,
         COUNT(a.id)::int AS application_count
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.recruiter_id = $1 AND j.deleted_at IS NULL
       GROUP BY j.id
       ORDER BY application_count DESC
       LIMIT 10`,
      [recruiterId],
    );
    return rows;
  },
};

import pool from '../config/database';
import { ApplicationModel, ApplicationStatus } from '../models/application.model';
import { JobModel } from '../models/job.model';
import { PipelineEventModel } from '../models/pipeline_event.model';
import { AppError } from '../utils/appError';
import { NotificationModel } from '../models/notification.model';

export const PipelineService = {
  // Guard access
  async checkEmployerPipelineAccess(recruiterId: string, jobId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    if (job.recruiter_id !== recruiterId) throw new AppError('Forbidden', 403);
    return job;
  },

  // 3. Implement Pipeline Board API
  async getPipelineBoard(recruiterId: string, jobId: string) {
    await this.checkEmployerPipelineAccess(recruiterId, jobId);

    // Optimized aggregation query using JSON_AGG
    const { rows } = await pool.query(
      `SELECT 
         status,
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'id', a.id,
             'applicant_id', a.applicant_id,
             'name', ap.name,
             'photo_url', ap.photo_url,
             'skills', ap.skills,
             'created_at', a.created_at,
             'status_updated_at', a.status_updated_at
           ) ORDER BY a.status_updated_at DESC
         ) FILTER (WHERE a.id IS NOT NULL) as candidates
       FROM applications a
       JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
       WHERE a.job_id = $1
       GROUP BY status`,
      [jobId]
    );

    const stages: Record<ApplicationStatus, any[]> = {
      applied: [],
      in_review: [],
      shortlisted: [],
      interview: [],
      offer: [],
      rejected: [],
      hired: [],
    };

    let totalCandidates = 0;
    
    // Map DB rows to response object
    for (const row of rows) {
      if (row.candidates) {
        stages[row.status as ApplicationStatus] = row.candidates;
        totalCandidates += row.candidates.length;
      }
    }

    // Get the last global update across all candidates
    const lastUpdatedRes = await pool.query(
      `SELECT MAX(status_updated_at) as last_updated FROM applications WHERE job_id = $1`,
      [jobId]
    );

    return {
      stages,
      totalCandidates,
      lastUpdated: lastUpdatedRes.rows[0].last_updated || null,
    };
  },

  // 2. Implement Move Candidate Stage API
  async moveCandidateStage(
    recruiterId: string,
    candidateId: string,
    jobId: string,
    toStage: ApplicationStatus,
    note?: string
  ) {
    const job = await this.checkEmployerPipelineAccess(recruiterId, jobId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const appRes = await client.query(
        `SELECT id, status FROM applications WHERE job_id = $1 AND applicant_id = $2 FOR UPDATE`,
        [jobId, candidateId]
      );

      if (!appRes.rows.length) {
        throw new AppError('Candidate application not found', 404);
      }

      const application = appRes.rows[0];
      if (application.status === toStage) {
        throw new AppError('Candidate is already in this stage', 400); // Prevent duplicate updates
      }

      const fromStage = application.status;

      // Update the application status
      await client.query(
        `UPDATE applications SET status = $1, status_updated_at = NOW() WHERE id = $2`,
        [toStage, application.id]
      );

      // Record stage history
      await client.query(
        `INSERT INTO pipeline_events (application_id, previous_status, new_status, changed_by_id, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [application.id, fromStage, toStage, recruiterId, note || null]
      );

      await client.query('COMMIT');

      // Async hooks - Create notification for applicant
      await NotificationModel.create({
        user_id: candidateId,
        type: 'application_status',
        title: 'Application Update',
        body: `Your application for "${job.title}" has been moved to ${toStage}.`,
        action_url: '/applications',
      }).catch(err => console.error('Failed to send notification', err));

      // Return real-time snapshot
      return await this.getPipelineBoard(recruiterId, jobId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // 5. Implement Pipeline Stage History Tracking API
  async getCandidateHistory(recruiterId: string, candidateId: string, jobId: string) {
    await this.checkEmployerPipelineAccess(recruiterId, jobId);

    const appRes = await pool.query(
      `SELECT id FROM applications WHERE job_id = $1 AND applicant_id = $2`,
      [jobId, candidateId]
    );

    if (!appRes.rows.length) {
      throw new AppError('Candidate application not found for this job', 404);
    }

    return PipelineEventModel.findByApplication(appRes.rows[0].id);
  }
};

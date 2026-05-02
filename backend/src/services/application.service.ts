import { ApplicationModel, ApplicationStatus } from '../models/application.model';
import { JobModel } from '../models/job.model';
import { NotificationModel } from '../models/notification.model';
import { PipelineEventModel } from '../models/pipeline_event.model';
import { withTransaction } from '../utils/transaction';
import { CreditService } from './credit.service';
import { CREDIT_COSTS } from '../config/creditCosts';
import { ResumeModel } from '../models/resume.model';
import { ProfileRequirementsService } from './profileRequirements.service';

export const ApplicationService = {
  async apply(
    applicantId: string,
    jobId: string,
    data: {
      cover_letter?: string;
      resume_snapshot_url?: string;
      resume_id: string;
      answers?: Array<{ question_id: string; answer: string }>;
    },
  ) {
    await ProfileRequirementsService.assertApplicantCanApply(applicantId);

    return withTransaction(async (client) => {
      // 1) Job validation (transaction-scoped)
      const job = await JobModel.findById(jobId, client);
      if (!job || job.status !== 'active')
        throw Object.assign(new Error('Job not found or no longer active'), { statusCode: 404 });

      // 2) Duplicate check (transaction-scoped)
      const existing = await ApplicationModel.findByJobAndApplicant(jobId, applicantId, client);
      if (existing)
        throw Object.assign(new Error('You have already applied to this job'), { statusCode: 409 });

      const selectedResumeId = String(data.resume_id || '').trim();
      if (!selectedResumeId) {
        throw Object.assign(new Error('Please select a resume before applying'), {
          statusCode: 422,
          code: 'RESUME_REQUIRED',
        });
      }

      const resume = await ResumeModel.findByUserAndId(applicantId, selectedResumeId);
      if (!resume) {
        throw Object.assign(new Error('Selected resume not found'), {
          statusCode: 404,
          code: 'RESUME_NOT_FOUND',
        });
      }

      const jobQuestions = Array.isArray(job.application_questions) ? job.application_questions : [];
      const submittedAnswers = Array.isArray(data.answers)
        ? data.answers
            .map((item) => ({
              question_id: String(item?.question_id || '').trim(),
              answer: String(item?.answer || '').trim(),
            }))
            .filter((item) => item.question_id.length > 0)
        : [];

      const answerMap = new Map(submittedAnswers.map((item) => [item.question_id, item.answer]));
      for (const question of jobQuestions) {
        if (!question.required) continue;
        const answer = answerMap.get(question.id) || '';
        if (!answer.trim()) {
          throw Object.assign(
            new Error(`Answer required for question: ${question.label}`),
            { statusCode: 422, code: 'MISSING_APPLICATION_ANSWER' },
          );
        }
      }

      const filteredAnswers = jobQuestions
        .map((question) => {
          const answer = answerMap.get(question.id);
          if (!answer || !answer.trim()) return null;
          return { question_id: question.id, answer: answer.trim() };
        })
        .filter((answer): answer is { question_id: string; answer: string } => Boolean(answer));

      // 3) Credit deduction (atomic under the same DB transaction)
      const { transactionId, balanceAfter } = await CreditService.deductCredits(
        applicantId,
        CREDIT_COSTS.APPLY_JOB,
        'Job application',
        jobId,
        client,
      );

      // 4) Create application (transaction-scoped)
      let application;
      try {
        application = await ApplicationModel.create(
          {
            job_id: jobId,
            applicant_id: applicantId,
            cover_letter: data.cover_letter,
            resume_snapshot_url: data.resume_snapshot_url,
            resume_id: selectedResumeId,
            application_answers: filteredAnswers,
          },
          client,
        );
      } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
        if (code === '23505') {
          throw Object.assign(new Error('You have already applied to this job'), { statusCode: 409 });
        }
        throw err;
      }

      // 5) Initial pipeline event
      await PipelineEventModel.create(
        {
          application_id: application.id,
          new_status: 'applied',
          changed_by_id: applicantId,
        },
        client,
      );

      // 6) Notify recruiter (transaction-scoped for consistent state)
      await NotificationModel.create(
        {
          user_id: job.recruiter_id,
          type: 'application_submitted',
          title: 'New application received',
          body: `A new applicant has applied to "${job.title}"`,
          action_url: `/recruiter/jobs/${jobId}/applications`,
        },
        client,
      );

      // 7) Milestone notification for recruiter on every 10 applications
      const totalApplications = await ApplicationModel.countByJob(jobId, client);
      if (totalApplications > 0 && totalApplications % 10 === 0) {
        await NotificationModel.create(
          {
            user_id: job.recruiter_id,
            type: 'application_submitted',
            title: 'Application milestone reached',
            body: `"${job.title}" has now reached ${totalApplications} applications.`,
            action_url: `/recruiter/jobs/${jobId}/applications`,
          },
          client,
        );
      }

      return {
        ...application,
        creditsRemaining: balanceAfter,
        creditTransactionId: transactionId,
      };
    });
  },

  async checkApplied(applicantId: string, jobId: string) {
    const existing = await ApplicationModel.findByJobAndApplicant(jobId, applicantId);
    return { hasApplied: !!existing };
  },

  async updateStatus(user: { userId: string; role: string }, applicationId: string, status: ApplicationStatus) {
    const application = await ApplicationModel.findById(applicationId);
    if (!application) throw Object.assign(new Error('Application not found'), { statusCode: 404 });

    const job = await JobModel.findById(application.job_id);
    if (!job || (user.role !== 'admin' && job.recruiter_id !== user.userId))
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

    const updated = await ApplicationModel.updateStatus(applicationId, status);

    // Pipeline event creation
    await PipelineEventModel.create({
      application_id: application.id,
      previous_status: application.status,
      new_status: status,
      changed_by_id: user.userId,
    });

    // Notify applicant
    await NotificationModel.create({
      user_id: application.applicant_id,
      type: 'application_status',
      title: 'Application status updated',
      body: `Your application for "${job.title}" is now: ${status.replace('_', ' ')}`,
      action_url: `/applications`,
    });

    return updated;
  },

  async getMyApplications(applicantId: string, page: number, limit: number) {
    return ApplicationModel.findByApplicant(applicantId, page, limit);
  },

  async getJobApplications(recruiterId: string, jobId: string, page: number, limit: number) {
    const job = await JobModel.findById(jobId);
    if (!job || job.recruiter_id !== recruiterId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      
    const result = await ApplicationModel.findByJob(jobId, page, limit);
    const { JobService } = require('./job.service');
    
    const enrichedApplications = await Promise.all(result.applications.map(async (app: any) => {
       const matchResult = await JobService.calculateMatchScore(app.skills || [], job.skills || []);
       return { ...app, matchScore: matchResult.matchScore };
    }));
    
    // Sort logically for Resume Ranking
    enrichedApplications.sort((a, b) => b.matchScore - a.matchScore);
    
    return { ...result, applications: enrichedApplications };
  },

  async getMyApplicationsWithFilters(
    applicantId: string,
    filters: { status?: ApplicationStatus; jobTitle?: string },
    page: number,
    limit: number,
  ) {
    return ApplicationModel.findByApplicantWithFilters(applicantId, filters, page, limit);
  },

  async getApplicationStatistics(applicantId: string) {
    return ApplicationModel.getApplicationStats(applicantId);
  },

  async getRecruiterApplications(recruiterId: string, page: number, limit: number) {
    return ApplicationModel.findByRecruiter(recruiterId, page, limit);
  },

  async getRecruiterApplicationsWithFilters(
    recruiterId: string,
    filters: { status?: ApplicationStatus; jobTitle?: string; applicantName?: string; jobId?: string; search?: string },
    page: number,
    limit: number,
  ) {
    return ApplicationModel.findByRecruiterWithFilters(recruiterId, filters, page, limit);
  },

  async getRecruiterApplicationsStatistics(recruiterId: string) {
    return ApplicationModel.getRecruiterApplicationStats(recruiterId);
  },

  async getRecruiterApplicationDetail(recruiterId: string, applicationId: string) {
    const application = await ApplicationModel.findRecruiterApplicationById(recruiterId, applicationId);
    if (!application) {
      throw Object.assign(new Error('Application not found'), { statusCode: 404 });
    }
    return application;
  },

  async getEvents(user: { userId: string; role: string }, applicationId: string) {
    const application = await ApplicationModel.findById(applicationId);
    if (!application) throw Object.assign(new Error('Application not found'), { statusCode: 404 });

    if (user.role === 'applicant' && application.applicant_id !== user.userId) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }

    if (user.role === 'recruiter') {
      const job = await JobModel.findById(application.job_id);
      if (!job || job.recruiter_id !== user.userId) {
        throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      }
    }

    return PipelineEventModel.findByApplication(applicationId);
  },
};

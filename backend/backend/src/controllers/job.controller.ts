import { Request, Response, NextFunction } from 'express';
import { JobService } from '../services/job.service';
import { JobType } from '../models/job.model';
import { sendSuccess, sendPaginated } from '../utils/response';

export const JobController = {
  async getJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const status = req.query.status as string | undefined;
      const type = req.query.type as JobType | undefined;
      const keywordRaw = req.query.keyword;
      const locationRaw = req.query.location;
      const salaryMinRaw = req.query.salary_min;
      const salaryMaxRaw = req.query.salary_max;
      const skillsRaw = req.query.skills;
      const excludeAppliedRaw = req.query.exclude_applied;

      const keyword = typeof keywordRaw === 'string' ? keywordRaw.trim() : undefined;
      const location = typeof locationRaw === 'string' ? locationRaw.trim() : undefined;
      const salary_min = typeof salaryMinRaw === 'string' ? Number(salaryMinRaw) : undefined;
      const salary_max = typeof salaryMaxRaw === 'string' ? Number(salaryMaxRaw) : undefined;
      const excludeApplied =
        typeof excludeAppliedRaw === 'string' && ['1', 'true', 'yes'].includes(excludeAppliedRaw.toLowerCase());
      const excludeAppliedForApplicantId =
        excludeApplied && req.user?.role === 'applicant' ? req.user.userId : undefined;

      const normalizedSkills = (() => {
        if (!skillsRaw) return undefined;

        const rawValues = Array.isArray(skillsRaw)
          ? skillsRaw.flatMap((value) => String(value).split(','))
          : String(skillsRaw).split(',');

        const normalized = rawValues
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0);

        return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
      })();

      const { jobs, pagination } = await JobService.getJobs({
        page,
        limit,
        status,
        type: type ? type.toLowerCase() as JobType : undefined,
        keyword: keyword && keyword.length > 0 ? keyword : undefined,
        location: location && location.length > 0 ? location : undefined,
        salary_min,
        salary_max,
        skills: normalizedSkills,
        excludeAppliedForApplicantId,
        onlyApproved: req.user?.role === 'applicant',
        prioritizeSpazorlabs: req.user?.role === 'applicant',
      });

      sendPaginated(res, jobs, pagination.total, pagination.page, pagination.limit, 'Jobs fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        keyword: req.query.keyword as string,
        location: req.query.location as string,
        type: req.query.type as JobType | undefined,
        salary_min: req.query.salary_min ? parseInt(req.query.salary_min as string) : undefined,
        salary_max: req.query.salary_max ? parseInt(req.query.salary_max as string) : undefined,
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sort: req.query.sort as 'relevance' | 'date' | 'salary',
      };
      const { jobs, total } = await JobService.searchJobs(filters);
      sendPaginated(res, jobs, total, filters.page!, filters.limit!);
    } catch (err) {
      next(err);
    }
  },

  async getJobById(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.id as string;
      const userId = req.user?.userId || null;
      const job = await JobService.getJobById(jobId, userId);
      sendSuccess(res, job, 'Job fetched successfully');
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    return JobController.getJobById(req, res, next);
  },

  async createJob(req: Request, res: Response, next: NextFunction) {
    try {
      const recruiterId = req.user!.userId;
      const job = await JobService.createJob(recruiterId, req.body);
      sendSuccess(res, job, 'Job created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    return JobController.createJob(req, res, next);
  },

  async updateJob(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        res.status(400).json({ success: false, message: 'No fields provided for update' });
        return;
      }

      const jobId = req.params.id as string;
      const recruiterId = req.user!.userId;
      const job = await JobService.updateJob(jobId, recruiterId, req.body);
      sendSuccess(res, job, 'Job updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    return JobController.updateJob(req, res, next);
  },

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const job = await JobService.publishJob(req.user!.userId, req.params.id as string);
      sendSuccess(res, job, 'Job published');
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await JobService.deleteJob(req.user!.userId, req.params.id as string);
      sendSuccess(res, null, 'Job deleted');
    } catch (err) {
      next(err);
    }
  },

  async closeJob(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.id as string;
      const recruiterId = req.user!.userId;
      await JobService.closeJob(jobId, recruiterId);
      sendSuccess(res, null, 'Job closed successfully');
    } catch (err) {
      next(err);
    }
  },

  async approveJob(req: Request, res: Response, next: NextFunction) {
    try {
      const jobId = req.params.id as string;
      await JobService.approveJob(jobId);
      sendSuccess(res, null, 'Job approved successfully');
    } catch (err) {
      next(err);
    }
  },

  async myJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const jobs = await JobService.getRecruiterJobs(req.user!.userId);
      sendSuccess(res, jobs);
    } catch (err) {
      next(err);
    }
  },

  async getMatchScore(req: Request, res: Response, next: NextFunction) {
    try {
      const { userSkills, jobSkills } = req.body;
      const result = await JobService.calculateMatchScore(userSkills, jobSkills);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getSkillGap(req: Request, res: Response, next: NextFunction) {
    try {
      const { userSkills, requiredSkills } = req.body;
      const result = await JobService.analyzeSkillGap(userSkills, requiredSkills);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async generateInterviewQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { role, skills } = req.body;
      const result = await JobService.generateInterviewQuestions(role, skills);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
};

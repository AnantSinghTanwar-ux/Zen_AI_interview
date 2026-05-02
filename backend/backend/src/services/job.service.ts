import {
  JobModel,
  JobFilters,
  JobType,
  JobStatus,
  JobApplicationQuestion,
} from '../models/job.model';
import { CreditService } from './credit.service';
import { UserModel } from '../models/user.model';
import { AppError, badRequest, notFound } from '../utils/appError';
import { ProfileRequirementsService } from './profileRequirements.service';

export const JobService = {
  validateApplicationQuestions(questions: unknown): JobApplicationQuestion[] {
    if (questions === undefined) return [];
    if (!Array.isArray(questions)) {
      throw badRequest('application_questions must be an array');
    }

    if (questions.length > 30) {
      throw badRequest('application_questions cannot exceed 30 items');
    }

    const allowedTypes = new Set(['text', 'textarea', 'select', 'rating', 'link']);
    const normalized = questions.map((question, index) => {
      if (!question || typeof question !== 'object') {
        throw badRequest(`application_questions[${index}] must be an object`);
      }

      const item = question as Record<string, unknown>;
      const label = String(item.label || '').trim();
      if (!label) {
        throw badRequest(`application_questions[${index}].label is required`);
      }

      const type = String(item.type || 'text').trim().toLowerCase();
      if (!allowedTypes.has(type)) {
        throw badRequest(`application_questions[${index}].type is invalid`);
      }

      const options = Array.isArray(item.options)
        ? item.options
            .map((opt) => String(opt || '').trim())
            .filter((opt) => opt.length > 0)
        : [];

      if ((type === 'select' || type === 'rating') && options.length < 2) {
        throw badRequest(`application_questions[${index}].options must contain at least 2 values`);
      }

      return {
        id: typeof item.id === 'string' ? item.id : undefined,
        label,
        type,
        required: Boolean(item.required),
        section: typeof item.section === 'string' ? item.section : undefined,
        placeholder: typeof item.placeholder === 'string' ? item.placeholder : undefined,
        options: options.length > 0 ? options : undefined,
      } as JobApplicationQuestion;
    });

    return normalized;
  },

  async createJob(
    recruiterId: string,
    data: {
      title: string;
      description: string;
      type?: JobType;
      location?: string;
      salary_min?: number;
      salary_max?: number;
      skills?: string[];
      status?: JobStatus;
      application_questions?: JobApplicationQuestion[];
    },
  ) {
    const recruiter = await UserModel.findById(recruiterId);
    if (!recruiter) {
      throw new AppError('Recruiter not found', 404);
    }
    if (recruiter.banned_at) {
      throw new AppError('Recruiter account is banned', 403);
    }

    await ProfileRequirementsService.assertRecruiterCanPostJob(recruiterId);

    const isDuplicate = await JobModel.checkDuplicate(recruiterId, data.title);
    if (isDuplicate) {
      throw Object.assign(new Error('You already have an active or draft job with this title'), { statusCode: 409 });
    }

    const applicationQuestions = JobService.validateApplicationQuestions(data.application_questions);
    return JobModel.create({
      recruiter_id: recruiterId,
      ...data,
      application_questions: applicationQuestions,
    });
  },

  async publishJob(recruiterId: string, jobId: string) {
    await ProfileRequirementsService.assertRecruiterCanPostJob(recruiterId);

    const job = await JobModel.findById(jobId);
    if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    if (job.recruiter_id !== recruiterId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (job.status === 'active')
      throw Object.assign(new Error('Job is already active'), { statusCode: 400 });

    return JobModel.update(jobId, { status: 'active', job_approval_status: 'pending_approval' });
  },

  async closeJob(jobId: string, recruiterId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw new AppError('Job not found', 404);
    if (job.recruiter_id !== recruiterId)
      throw new AppError('Forbidden', 403);

    // Idempotent: if already closed, return success without DB write
    if (job.status === 'closed') {
      return; // Job already in desired state
    }

    // Update job status to closed
    await JobService._updateJobStatus(jobId, 'closed');
  },

  async _updateJobStatus(jobId: string, targetStatus: JobStatus) {
    // Extensible pattern for future status transitions
    // Currently only 'closed' is supported
    if (targetStatus !== 'closed') {
      throw new AppError('Unsupported status transition', 400);
    }
    await JobModel.closeJob(jobId);
  },

  async approveJob(jobId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) {
      throw notFound('Job');
    }

    // Idempotent: if already active, return success without DB write.
    if (job.status === 'active') {
      return job;
    }

    const allowedStatuses: JobStatus[] = ['draft', 'closed'];
    if (!allowedStatuses.includes(job.status)) {
      throw badRequest('Invalid status transition');
    }

    return JobModel.approveJob(jobId);
  },

  async getJobs(filters: {
    page?: number;
    limit?: number;
    status?: string;
    type?: JobType;
    keyword?: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    skills?: string[];
    excludeAppliedForApplicantId?: string;
    onlyApproved?: boolean;
    prioritizeSpazorlabs?: boolean;
  }) {
    // Normalize pagination safely.
    const normalizedPage = Number(filters.page);
    const normalizedLimit = Number(filters.limit);
    const page = Number.isFinite(normalizedPage) && normalizedPage >= 1 ? Math.floor(normalizedPage) : 1;
    const limit =
      Number.isFinite(normalizedLimit) && normalizedLimit >= 1
        ? Math.min(50, Math.floor(normalizedLimit))
        : 10;
    const offset = (page - 1) * limit;

    if (offset > 10000) {
      throw badRequest('Page limit exceeded');
    }

    // Build filter object safely
    const queryFilters: {
      status?: JobStatus;
      type?: JobType;
      keyword?: string;
      location?: string;
      salary_min?: number;
      salary_max?: number;
      skills?: string[];
      excludeAppliedForApplicantId?: string;
      onlyApproved?: boolean;
      prioritizeSpazorlabs?: boolean;
    } = {};
    const allowedStatus: JobStatus[] = ['draft', 'active', 'closed'];

    if (filters.status && allowedStatus.includes(filters.status as JobStatus)) {
      queryFilters.status = filters.status as JobStatus;
    }

    if (filters.type) {
      queryFilters.type = filters.type.toLowerCase() as JobType;
    }

    if (filters.keyword) {
      const normalizedKeyword = filters.keyword.trim();
      if (normalizedKeyword.length > 0) {
        queryFilters.keyword = normalizedKeyword;
      }
    }

    if (filters.location) {
      const normalizedLocation = filters.location.trim();
      if (normalizedLocation.length > 0) {
        queryFilters.location = normalizedLocation;
      }
    }

    if (filters.salary_min !== undefined) {
      if (!Number.isFinite(filters.salary_min)) {
        throw new AppError('salary_min must be a valid number', 422);
      }
      queryFilters.salary_min = filters.salary_min;
    }

    if (filters.salary_max !== undefined) {
      if (!Number.isFinite(filters.salary_max)) {
        throw new AppError('salary_max must be a valid number', 422);
      }
      queryFilters.salary_max = filters.salary_max;
    }

    if (
      queryFilters.salary_min !== undefined &&
      queryFilters.salary_max !== undefined &&
      queryFilters.salary_max < queryFilters.salary_min
    ) {
      throw new AppError('salary_max must be greater than or equal to salary_min', 422);
    }

    if (filters.skills && filters.skills.length > 0) {
      queryFilters.skills = filters.skills;
    }

    if (filters.excludeAppliedForApplicantId) {
      queryFilters.excludeAppliedForApplicantId = filters.excludeAppliedForApplicantId;
    }

    if (filters.onlyApproved) {
      queryFilters.onlyApproved = true;
    }

    if (filters.prioritizeSpazorlabs) {
      queryFilters.prioritizeSpazorlabs = true;
    }

    const result = await JobModel.findAll({ ...queryFilters, limit, offset });
    const jobs = result.rows;
    const total = Number(result.total);
    const totalPages = Math.ceil(total / limit);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async searchJobs(filters: JobFilters) {
    return JobModel.search(filters);
  },

  async getJobById(id: string, userId: string | null = null) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) throw notFound('Job');

    const job = await JobModel.findById(id);
    if (!job) throw notFound('Job');

    if (job.status === 'draft') {
      if (!userId || job.recruiter_id !== userId) {
        throw notFound('Job');
      }
    }

    return job;
  },

  async updateJob(jobId: string, recruiterId: string, data: Parameters<typeof JobModel.update>[1]) {
    const job = await JobModel.findById(jobId);
    if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    if (job.recruiter_id !== recruiterId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

    const allowedFields = [
      'title',
      'description',
      'location',
      'salary_min',
      'salary_max',
      'type',
      'skills',
      'application_questions',
    ] as const;
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key]) => (allowedFields as readonly string[]).includes(key)),
    ) as Parameters<typeof JobModel.update>[1];

    if (filteredData.application_questions !== undefined) {
      filteredData.application_questions = JobService.validateApplicationQuestions(
        filteredData.application_questions,
      );
    }

    if (Object.keys(filteredData).length === 0) {
      throw badRequest('No valid fields provided for update');
    }

    const effectiveSalaryMin =
      filteredData.salary_min !== undefined ? Number(filteredData.salary_min) : job.salary_min;
    const effectiveSalaryMax =
      filteredData.salary_max !== undefined ? Number(filteredData.salary_max) : job.salary_max;

    if (
      effectiveSalaryMin !== null &&
      effectiveSalaryMax !== null &&
      effectiveSalaryMax < effectiveSalaryMin
    ) {
      throw badRequest('salary_max must be greater than or equal to salary_min');
    }

    return JobModel.update(jobId, filteredData);
  },

  async deleteJob(recruiterId: string, jobId: string) {
    const job = await JobModel.findById(jobId);
    if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    if (job.recruiter_id !== recruiterId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    await JobModel.softDelete(jobId);
  },

  async getRecruiterJobs(recruiterId: string) {
    return JobModel.findByRecruiter(recruiterId);
  },

  async calculateMatchScore(userSkills: string[], jobSkills: string[]): Promise<{ matchScore: number; matchedSkills: string[]; missingSkills: string[] }> {
    if (!Array.isArray(userSkills) || !Array.isArray(jobSkills)) {
      return { matchScore: 0, matchedSkills: [], missingSkills: [] };
    }
    
    try {
      const natural = require('natural');
      
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];

      for (const jSkill of jobSkills) {
        let isMatch = false;
        for (const uSkill of userSkills) {
          const normJ = jSkill.toLowerCase().trim();
          const normU = uSkill.toLowerCase().trim();
          
          if (normJ === normU) {
            isMatch = true;
            break;
          }
          
          // Fuzzy match threshold 0.85 (accommodates e.g. Node vs Node.js)
          const distance = natural.JaroWinklerDistance(normJ, normU, { ignoreCase: true });
          if (distance >= 0.85) {
            isMatch = true;
            break;
          }
        }
        
        if (isMatch) {
          matchedSkills.push(jSkill);
        } else {
          missingSkills.push(jSkill);
        }
      }

      const matchScore = jobSkills.length > 0
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : 0;

      return { matchScore, matchedSkills, missingSkills };
    } catch (e) {
      console.error('Job Match Error:', e);
      return { matchScore: 0, matchedSkills: [], missingSkills: jobSkills };
    }
  },

  async analyzeSkillGap(userSkills: string[], requiredSkills: string[]): Promise<{ missingSkills: string[], suggestions: Record<string, string> }> {
      const { missingSkills } = await JobService.calculateMatchScore(userSkills, requiredSkills);
      const suggestions: Record<string, string> = {};
      for (const skill of missingSkills) {
          suggestions[skill] = `Consider taking an online course or practicing projects related to ${skill}.`;
      }
      return { missingSkills, suggestions };
  },

  async generateInterviewQuestions(role: string, skills: string[]): Promise<{ questions: string[] }> {
      const staticFallback = [
          `Can you explain your experience with ${skills && skills.length > 0 ? skills[0] : 'the required skills'}?`,
          `Describe a challenging project you worked on as a ${role || 'professional'}.`,
          `How do you keep your technical skills up to date?`,
          `Can you describe a time you had to learn a new technology quickly?`,
          `What is your approach to problem-solving and debugging?`
      ];

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || !role || !skills || skills.length === 0) {
          return { questions: staticFallback };
      }

      try {
          const prompt = `Generate 5 technical interview questions for a ${role} role requiring the following skills: ${skills.join(', ')}. Return only the questions separated by newlines, without numbering.`;
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [{ role: 'user', content: prompt }]
              })
          });

          if (!response.ok) {
              return { questions: staticFallback };
          }

          const data = (await response.json()) as any;
          const content = data.choices?.[0]?.message?.content || '';
          const questions = content.split('\n').filter((q: string) => q.trim().length > 0).map((q: string) => q.replace(/^\d+\.\s*/, '').trim());

          return { questions: questions.length > 0 ? questions : staticFallback };
      } catch (error) {
          return { questions: staticFallback };
      }
  },
};

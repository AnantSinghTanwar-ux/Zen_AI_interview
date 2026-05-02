import pool from '../config/database';
import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

export type JobType = 'full-time' | 'part-time' | 'contract' | 'remote' | 'internship';
export type JobStatus = 'draft' | 'active' | 'closed';
export type JobApprovalStatus = 'pending_approval' | 'approved' | 'rejected';
export type JobSource = 'admin_external' | 'recruiter' | 'admin_company';

export interface JobCompany {
  id: string | null;
  name: string;
  logo: string | null;
  website: string | null;
  location: string | null;
}

export type JobApplicationQuestionType = 'text' | 'textarea' | 'select' | 'rating' | 'link';

export interface JobApplicationQuestion {
  id: string;
  label: string;
  type: JobApplicationQuestionType;
  required: boolean;
  section?: string;
  placeholder?: string;
  options?: string[];
}

export interface Job {
  id: string;
  recruiter_id: string;
  company_id: string | null;
  company_name: string;
  company_logo: string | null;
  company_website: string | null;
  company_location: string | null;
  is_external_company: boolean;
  source: JobSource;
  created_by: string | null;
  company: JobCompany;
  application_questions: JobApplicationQuestion[];
  title: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  type: JobType;
  skills: string[];
  description: string;
  status: JobStatus;
  job_approval_status: JobApprovalStatus;
  approved_by: string | null;
  approved_at: Date | null;
  is_boosted: boolean;
  views_count: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface JobFilters {
  keyword?: string;
  location?: string;
  type?: JobType;
  skills?: string[];
  salary_min?: number;
  salary_max?: number;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'date' | 'salary';
}

type JobRow = Omit<Job, 'company'> & { company: JobCompany };

let applicationQuestionsColumnExists: boolean | null = null;

const allowedQuestionTypes: JobApplicationQuestionType[] = ['text', 'textarea', 'select', 'rating', 'link'];

async function hasApplicationQuestionsColumn(client?: PoolClient): Promise<boolean> {
  if (applicationQuestionsColumnExists !== null) {
    return applicationQuestionsColumnExists;
  }

  const db = client ?? pool;
  const { rows } = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name = 'application_questions'
      LIMIT 1`,
  );

  applicationQuestionsColumnExists = rows.length > 0;
  return applicationQuestionsColumnExists;
}

function normalizeQuestionType(value: unknown): JobApplicationQuestionType {
  const normalized = String(value || 'text').trim().toLowerCase() as JobApplicationQuestionType;
  return allowedQuestionTypes.includes(normalized) ? normalized : 'text';
}

export function normalizeQuestions(raw: unknown): JobApplicationQuestion[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const label = String(source.label || '').trim();
      if (!label) return null;

      const type = normalizeQuestionType(source.type);
      const optionsRaw = Array.isArray(source.options)
        ? source.options
            .map((opt) => String(opt || '').trim())
            .filter((opt) => opt.length > 0)
        : [];
      const options = (type === 'select' || type === 'rating') && optionsRaw.length > 0 ? Array.from(new Set(optionsRaw)) : undefined;

      return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : randomUUID(),
        label,
        type,
        required: Boolean(source.required),
        section: typeof source.section === 'string' && source.section.trim() ? source.section.trim() : undefined,
        placeholder:
          typeof source.placeholder === 'string' && source.placeholder.trim()
            ? source.placeholder.trim()
            : undefined,
        options,
      } as JobApplicationQuestion;
    })
    .filter((question): question is JobApplicationQuestion => Boolean(question));
}

const mapJobRow = (row: Record<string, any>): JobRow => {
  const companyName = (row.company_name || '').trim() || 'Unknown Company';
  const questions = normalizeQuestions(row.application_questions);

  return {
    ...row,
    company_id: row.company_id ?? null,
    company_name: companyName,
    company_logo: row.company_logo ?? null,
    company_website: row.company_website ?? null,
    company_location: row.company_location ?? row.location ?? null,
    is_external_company: Boolean(row.is_external_company),
    source: (row.source ?? 'recruiter') as JobSource,
    created_by: row.created_by ?? null,
    application_questions: questions,
    company: {
      id: row.company_id ?? null,
      name: companyName,
      logo: row.company_logo ?? null,
      website: row.company_website ?? null,
      location: row.company_location ?? row.location ?? null,
    },
  } as JobRow;
};

export const JobModel = {
  async findById(id: string, client?: PoolClient): Promise<Job | null> {
    const db = client ?? pool;
    const { rows } = await db.query(
      `SELECT
        jobs.*,
        COALESCE(jobs.company_id, recruiter_profiles.id) AS company_id,
        COALESCE(NULLIF(jobs.company_name, ''), recruiter_profiles.company_name, 'Unknown Company') AS company_name,
        COALESCE(jobs.company_logo, recruiter_profiles.logo_url) AS company_logo,
        COALESCE(jobs.company_website, recruiter_profiles.website) AS company_website,
        COALESCE(jobs.company_location, jobs.location, recruiter_profiles.location) AS company_location
       FROM jobs
       LEFT JOIN recruiter_profiles ON recruiter_profiles.user_id = jobs.recruiter_id
       WHERE jobs.id = $1
         AND jobs.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ? mapJobRow(rows[0]) : null;
  },

  async checkDuplicate(recruiterId: string, title: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM jobs WHERE recruiter_id = $1 AND title ILIKE $2 AND status IN ('active', 'draft') AND deleted_at IS NULL`,
      [recruiterId, title]
    );
    return rows.length > 0;
  },

  async create(data: {
    recruiter_id: string;
    title: string;
    description: string;
    type?: JobType;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    skills?: string[];
    status?: JobStatus;
    company_id?: string | null;
    company_name?: string;
    company_logo?: string;
    company_website?: string;
    company_location?: string;
    is_external_company?: boolean;
    source?: JobSource;
    created_by?: string;
    application_questions?: JobApplicationQuestion[];
  }): Promise<Job> {
    const hasType = data.type !== undefined;

    // Recruiter flow compatibility: company branding follows recruiter profile when not explicitly provided.
    let companyId = data.company_id ?? null;
    let companyName = data.company_name?.trim();
    let companyLogo = data.company_logo ?? null;
    let companyWebsite = data.company_website ?? null;
    let companyLocation = data.company_location ?? data.location ?? null;
    const isExternalCompany = Boolean(data.is_external_company);
    const source: JobSource = data.source ?? 'recruiter';
    const createdBy = data.created_by ?? data.recruiter_id;
    const questions = normalizeQuestions(data.application_questions);
    const hasQuestionsColumn = await hasApplicationQuestionsColumn();
    const approvalStatus = source === 'recruiter' ? 'pending_approval' : 'approved';

    if (!companyName || !companyId) {
      const profileRes = await pool.query(
        `SELECT id, company_name, logo_url, website, location
         FROM recruiter_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [data.recruiter_id],
      );

      const recruiterCompany = profileRes.rows[0];
      if (!companyId) companyId = recruiterCompany?.id ?? null;
      if (!companyName) companyName = recruiterCompany?.company_name ?? 'Unknown Company';
      if (!companyLogo) companyLogo = recruiterCompany?.logo_url ?? null;
      if (!companyWebsite) companyWebsite = recruiterCompany?.website ?? null;
      if (!companyLocation) companyLocation = recruiterCompany?.location ?? null;
    }

    const { rows } = hasType
      ? await pool.query(
        `INSERT INTO jobs (
            recruiter_id,
            title,
            description,
            type,
            location,
            salary_min,
            salary_max,
            skills,
            status,
            company_id,
            company_name,
            company_logo,
            company_website,
            company_location,
            is_external_company,
            source,
            created_by,
            job_approval_status${hasQuestionsColumn ? ', application_questions' : ''}
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18${hasQuestionsColumn ? ',$19' : ''})
          RETURNING *`,
        [
          data.recruiter_id,
          data.title,
          data.description,
          data.type,
          data.location || null,
          data.salary_min || null,
          data.salary_max || null,
          data.skills || [],
          data.status || 'draft',
          companyId,
          companyName,
          companyLogo,
          companyWebsite,
          companyLocation,
          isExternalCompany,
          source,
          createdBy,
          approvalStatus,
          ...(hasQuestionsColumn ? [JSON.stringify(questions)] : []),
        ],
      )
      : await pool.query(
        `INSERT INTO jobs (
            recruiter_id,
            title,
            description,
            location,
            salary_min,
            salary_max,
            skills,
            status,
            company_id,
            company_name,
            company_logo,
            company_website,
            company_location,
            is_external_company,
            source,
            created_by,
            job_approval_status${hasQuestionsColumn ? ', application_questions' : ''}
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17${hasQuestionsColumn ? ',$18' : ''})
          RETURNING *`,
        [
          data.recruiter_id,
          data.title,
          data.description,
          data.location || null,
          data.salary_min || null,
          data.salary_max || null,
          data.skills || [],
          data.status || 'draft',
          companyId,
          companyName,
          companyLogo,
          companyWebsite,
          companyLocation,
          isExternalCompany,
          source,
          createdBy,
          approvalStatus,
          ...(hasQuestionsColumn ? [JSON.stringify(questions)] : []),
        ],
      );
    return mapJobRow(rows[0]);
  },

  async createByAdmin(data: {
    admin_id: string;
    title: string;
    description: string;
    type?: JobType;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    skills?: string[];
    status?: JobStatus;
    company_id?: string;
    company_name?: string;
    company_logo?: string;
    company_website?: string;
    company_location?: string;
    application_questions?: JobApplicationQuestion[];
  }): Promise<Job> {
    const hasType = data.type !== undefined;

    const normalizedCompanyId = data.company_id?.trim() || null;
    const normalizedCompanyName = data.company_name?.trim();
    const normalizedCompanyLocation = data.company_location?.trim();

    if (!normalizedCompanyId && !normalizedCompanyName) {
      throw Object.assign(new Error('COMPANY_REQUIRED'), { statusCode: 400, code: 'COMPANY_REQUIRED' });
    }

    let recruiterIdForOwner = data.admin_id;
    let companyId: string | null = null;
    let companyName = normalizedCompanyName || '';
    let companyLogo = data.company_logo || null;
    let companyWebsite = data.company_website || null;
    let companyLocation = normalizedCompanyLocation || data.location || null;
    let isExternalCompany = false;
    let source: JobSource = 'admin_external';
    const questions = normalizeQuestions(data.application_questions);
    const hasQuestionsColumn = await hasApplicationQuestionsColumn();

    if (normalizedCompanyId) {
      const companyRes = await pool.query(
        `SELECT id, user_id, company_name, logo_url, website, location
         FROM recruiter_profiles
         WHERE id = $1
         LIMIT 1`,
        [normalizedCompanyId],
      );

      const company = companyRes.rows[0];
      if (!company) {
        throw Object.assign(new Error('COMPANY_NOT_FOUND'), { statusCode: 404, code: 'COMPANY_NOT_FOUND' });
      }

      recruiterIdForOwner = company.user_id;
      companyId = company.id;
      companyName = normalizedCompanyName || company.company_name || 'Unknown Company';
      companyLogo = data.company_logo || company.logo_url || null;
      companyWebsite = data.company_website || company.website || null;
      companyLocation = normalizedCompanyLocation || data.location || company.location || null;
      isExternalCompany = false;
      source = 'admin_company';
    } else {
      if (!normalizedCompanyName || !normalizedCompanyLocation) {
        throw Object.assign(new Error('External company requires company_name and company_location'), {
          statusCode: 400,
          code: 'COMPANY_REQUIRED',
        });
      }
      isExternalCompany = true;
      source = 'admin_external';
    }

    const { rows } = hasType
      ? await pool.query(
        `INSERT INTO jobs (
            recruiter_id,
            title,
            description,
            type,
            location,
            salary_min,
            salary_max,
            skills,
            status,
            company_id,
            company_name,
            company_logo,
            company_website,
            company_location,
            is_external_company,
            source,
            created_by${hasQuestionsColumn ? ', application_questions' : ''}
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17${hasQuestionsColumn ? ',$18' : ''})
          RETURNING *`,
        [
          recruiterIdForOwner,
          data.title,
          data.description,
          data.type,
          data.location || companyLocation || null,
          data.salary_min || null,
          data.salary_max || null,
          data.skills || [],
          data.status || 'active',
          companyId,
          companyName,
          companyLogo,
          companyWebsite,
          companyLocation,
          isExternalCompany,
          source,
          data.admin_id,
          ...(hasQuestionsColumn ? [JSON.stringify(questions)] : []),
        ],
      )
      : await pool.query(
        `INSERT INTO jobs (
            recruiter_id,
            title,
            description,
            location,
            salary_min,
            salary_max,
            skills,
            status,
            company_id,
            company_name,
            company_logo,
            company_website,
            company_location,
            is_external_company,
            source,
            created_by${hasQuestionsColumn ? ', application_questions' : ''}
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16${hasQuestionsColumn ? ',$17' : ''})
          RETURNING *`,
        [
          recruiterIdForOwner,
          data.title,
          data.description,
          data.location || companyLocation || null,
          data.salary_min || null,
          data.salary_max || null,
          data.skills || [],
          data.status || 'active',
          companyId,
          companyName,
          companyLogo,
          companyWebsite,
          companyLocation,
          isExternalCompany,
          source,
          data.admin_id,
          ...(hasQuestionsColumn ? [JSON.stringify(questions)] : []),
        ],
      );

    return mapJobRow(rows[0]);
  },

  async update(
    id: string,
    data: Partial<
      Omit<Job, 'id' | 'recruiter_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'views_count'>
    >,
  ): Promise<Job> {
    const fields = Object.keys(data);
    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw Object.assign(new Error('Job not found'), { statusCode: 404 });
      }
      return existing;
    }

    const hasQuestionsColumn = await hasApplicationQuestionsColumn();
    const sanitizedData: Record<string, unknown> = { ...data };

    if (!hasQuestionsColumn) {
      delete sanitizedData.application_questions;
    }

    if (sanitizedData.application_questions !== undefined) {
      sanitizedData.application_questions = JSON.stringify(
        normalizeQuestions(sanitizedData.application_questions),
      );
    }

    const sanitizedFields = Object.keys(sanitizedData);
    if (sanitizedFields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw Object.assign(new Error('Job not found'), { statusCode: 404 });
      }
      return existing;
    }

    const values = Object.values(sanitizedData);
    const setClause = sanitizedFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE jobs SET ${setClause}, updated_at = NOW() WHERE id = $${sanitizedFields.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id],
    );
    return mapJobRow(rows[0]);
  },

  async closeJob(id: string): Promise<void> {
    await pool.query(
      `UPDATE jobs SET status = 'closed', updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  },

  async approveJob(id: string): Promise<Job> {
    const { rows } = await pool.query(
      `UPDATE jobs SET status = 'active', updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id],
    );
    return mapJobRow(rows[0]);
  },

  async softDelete(id: string): Promise<void> {
    await pool.query(`UPDATE jobs SET deleted_at = NOW() WHERE id = $1`, [id]);
  },

  async incrementViews(id: string): Promise<void> {
    await pool.query(`UPDATE jobs SET views_count = views_count + 1 WHERE id = $1`, [id]);
  },

  async search(filters: JobFilters): Promise<{ jobs: Job[]; total: number }> {
    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    const conditions: string[] = [`j.status = 'active'`, `j.deleted_at IS NULL`];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.keyword) {
      conditions.push(`j.search_vector @@ plainto_tsquery('english', $${idx})`);
      params.push(filters.keyword);
      idx++;
    }
    if (filters.location) {
      conditions.push(`j.location ILIKE $${idx}`);
      params.push(`%${filters.location}%`);
      idx++;
    }
    if (filters.type) {
      conditions.push(`j.type = $${idx}`);
      params.push(filters.type);
      idx++;
    }
    if (filters.salary_min) {
      conditions.push(`j.salary_max >= $${idx}`);
      params.push(filters.salary_min);
      idx++;
    }
    if (filters.salary_max) {
      conditions.push(`j.salary_min <= $${idx}`);
      params.push(filters.salary_max);
      idx++;
    }
    if (filters.skills?.length) {
      conditions.push(`j.skills && $${idx}`);
      params.push(filters.skills);
      idx++;
    }

    const where = conditions.join(' AND ');
    const orderBy =
      filters.sort === 'salary'
        ? 'j.salary_max DESC NULLS LAST'
        : filters.sort === 'relevance' && filters.keyword
          ? `ts_rank(j.search_vector, plainto_tsquery('english', $1)) DESC`
          : 'j.created_at DESC';

    const countQuery = `SELECT COUNT(*) FROM jobs j WHERE ${where}`;
    const dataQuery = `SELECT
      j.*,
      COALESCE(j.company_id, rp.id) AS company_id,
      COALESCE(NULLIF(j.company_name, ''), rp.company_name, 'Unknown Company') AS company_name,
      COALESCE(j.company_logo, rp.logo_url) AS company_logo,
      COALESCE(j.company_website, rp.website) AS company_website,
      COALESCE(j.company_location, j.location, rp.location) AS company_location
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
      WHERE ${where} ORDER BY ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, limit, offset]),
    ]);

    return { jobs: dataResult.rows.map(mapJobRow), total: parseInt(countResult.rows[0].count) };
  },

  async findAll(filters: {
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
    limit: number;
    offset: number;
  }): Promise<{ rows: Job[]; total: number }> {
    // Build WHERE clause once and reuse in both COUNT and SELECT queries.
    const conditions: string[] = ['jobs.deleted_at IS NULL'];
    const values: unknown[] = [];
    let index = 1;

    if (filters.status) {
      conditions.push(`jobs.status = $${index++}`);
      values.push(filters.status);
    }

    if (filters.type) {
      conditions.push(`jobs.type = $${index++}`);
      values.push(filters.type);
    }

    if (filters.keyword) {
      conditions.push(`(jobs.title ILIKE $${index} OR jobs.description ILIKE $${index})`);
      values.push(`%${filters.keyword}%`);
      index++;
    }

    if (filters.location) {
      conditions.push(`jobs.location ILIKE $${index++}`);
      values.push(`%${filters.location}%`);
    }

    if (filters.salary_min !== undefined) {
      // SQL three-valued logic: rows with salary_min = NULL do not satisfy >= comparisons.
      conditions.push(`jobs.salary_min >= $${index++}`);
      values.push(filters.salary_min);
    }

    if (filters.salary_max !== undefined) {
      // SQL three-valued logic: rows with salary_max = NULL do not satisfy <= comparisons.
      conditions.push(`jobs.salary_max <= $${index++}`);
      values.push(filters.salary_max);
    }

    // Guard against empty skills arrays so we never emit jobs.skills @> '{}' (which matches all rows).
    if (filters.skills && filters.skills.length > 0) {
      conditions.push(`jobs.skills @> $${index++}::text[]`);
      values.push(filters.skills);
    }

    if (filters.excludeAppliedForApplicantId) {
      conditions.push(`NOT EXISTS (
        SELECT 1
        FROM applications a
        WHERE a.job_id = jobs.id
          AND a.applicant_id = $${index++}
      )`);
      values.push(filters.excludeAppliedForApplicantId);
    }

    // For applicants, only show approved jobs
    if (filters.onlyApproved) {
      conditions.push(`jobs.job_approval_status = $${index++}`);
      values.push('approved');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const priorityOrderClause =
      "CASE WHEN regexp_replace(lower(COALESCE(NULLIF(jobs.company_name, ''), recruiter_profiles.company_name, '')), '[^a-z0-9]', '', 'g') LIKE '%spazorlabs%' THEN 0 ELSE 1 END";
    const orderByClause = filters.prioritizeSpazorlabs
      ? `${priorityOrderClause}, jobs.created_at DESC, jobs.id DESC`
      : 'jobs.created_at DESC, jobs.id DESC';

    const countQuery = `SELECT COUNT(*) FROM jobs ${whereClause}`;
    const selectQuery = `SELECT
      jobs.*,
      COALESCE(jobs.company_id, recruiter_profiles.id) AS company_id,
      COALESCE(NULLIF(jobs.company_name, ''), recruiter_profiles.company_name, 'Unknown Company') AS company_name,
      COALESCE(jobs.company_logo, recruiter_profiles.logo_url) AS company_logo,
      COALESCE(jobs.company_website, recruiter_profiles.website) AS company_website,
      COALESCE(jobs.company_location, jobs.location, recruiter_profiles.location) AS company_location
      FROM jobs
      LEFT JOIN recruiter_profiles ON recruiter_profiles.user_id = jobs.recruiter_id
      ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${index++} OFFSET $${index++}`;

    const [countResult, selectResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(selectQuery, [...values, filters.limit, filters.offset]),
    ]);

    return { rows: selectResult.rows.map(mapJobRow), total: Number(countResult.rows[0].count) };
  },

  async findByRecruiter(recruiterId: string): Promise<Job[]> {
    const { rows } = await pool.query(
      `SELECT
        j.*,
        COALESCE(j.company_id, rp.id) AS company_id,
        COALESCE(NULLIF(j.company_name, ''), rp.company_name, 'Unknown Company') AS company_name,
        COALESCE(j.company_logo, rp.logo_url) AS company_logo,
        COALESCE(j.company_website, rp.website) AS company_website,
        COALESCE(j.company_location, j.location, rp.location) AS company_location,
        (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id)::int AS application_count
       FROM jobs j
       LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
       WHERE j.recruiter_id = $1 AND j.deleted_at IS NULL ORDER BY j.created_at DESC`,
      [recruiterId],
    );
    return rows.map(mapJobRow);
  },

  // ── Saved Jobs ──────────────────────────────────────────────────────────────

  async saveJob(applicantId: string, jobId: string): Promise<void> {
    await pool.query(
      `INSERT INTO saved_jobs (applicant_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [applicantId, jobId],
    );
  },

  async unsaveJob(applicantId: string, jobId: string): Promise<void> {
    await pool.query(`DELETE FROM saved_jobs WHERE applicant_id = $1 AND job_id = $2`, [
      applicantId,
      jobId,
    ]);
  },

  async getSavedJobs(applicantId: string): Promise<Job[]> {
    const { rows } = await pool.query(
      `SELECT
        j.*,
        COALESCE(j.company_id, rp.id) AS company_id,
        COALESCE(NULLIF(j.company_name, ''), rp.company_name, 'Unknown Company') AS company_name,
        COALESCE(j.company_logo, rp.logo_url) AS company_logo,
        COALESCE(j.company_website, rp.website) AS company_website,
        COALESCE(j.company_location, j.location, rp.location) AS company_location,
        sj.saved_at
       FROM saved_jobs sj
       JOIN jobs j ON j.id = sj.job_id
       LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
       WHERE sj.applicant_id = $1 AND j.deleted_at IS NULL
       ORDER BY sj.saved_at DESC`,
      [applicantId],
    );
    return rows.map(mapJobRow);
  },

  async isSaved(applicantId: string, jobId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM saved_jobs WHERE applicant_id = $1 AND job_id = $2`,
      [applicantId, jobId],
    );
    return rows.length > 0;
  },

  // ── Admin ───────────────────────────────────────────────────────────────────

  async adminList(filters: {
    status?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    const conditions: string[] = ['j.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`j.status = $${idx}`);
      params.push(filters.status);
      idx++;
    }
    if (filters.search) {
      conditions.push(`j.title ILIKE $${idx}`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (filters.page - 1) * filters.limit;

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM jobs j WHERE ${where}`, params),
      pool.query(
        `SELECT
          j.*,
          COALESCE(j.company_id, rp.id) AS company_id,
          COALESCE(NULLIF(j.company_name, ''), rp.company_name, 'Unknown Company') AS company_name,
          COALESCE(j.company_logo, rp.logo_url) AS company_logo,
          COALESCE(j.company_website, rp.website) AS company_website,
          COALESCE(j.company_location, j.location, rp.location) AS company_location
         FROM jobs j
         LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
         WHERE ${where} ORDER BY j.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, filters.limit, offset],
      ),
    ]);

    return { jobs: dataRes.rows.map(mapJobRow), total: parseInt(countRes.rows[0].count) };
  },

  async approveJobByAdmin(jobId: string, adminId: string): Promise<Job> {
    const { rows } = await pool.query(
      `UPDATE jobs 
       SET status = 'active', job_approval_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL 
       RETURNING *`,
      [adminId, jobId],
    );
    if (!rows[0]) {
      throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    }
    return mapJobRow(rows[0]);
  },

  async rejectJobByAdmin(jobId: string, adminId: string): Promise<Job> {
    const { rows } = await pool.query(
      `UPDATE jobs 
       SET status = 'closed', job_approval_status = 'rejected', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL 
       RETURNING *`,
      [adminId, jobId],
    );
    if (!rows[0]) {
      throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    }
    return mapJobRow(rows[0]);
  },

  async getPendingApprovalJobs(filters: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ jobs: Job[]; total: number }> {
    const conditions: string[] = ['j.deleted_at IS NULL', `j.job_approval_status = 'pending_approval'`];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(`j.title ILIKE $${idx}`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (filters.page - 1) * filters.limit;

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM jobs j WHERE ${where}`, params),
      pool.query(
        `SELECT
          j.*,
          COALESCE(j.company_id, rp.id) AS company_id,
          COALESCE(NULLIF(j.company_name, ''), rp.company_name, 'Unknown Company') AS company_name,
          COALESCE(j.company_logo, rp.logo_url) AS company_logo,
          COALESCE(j.company_website, rp.website) AS company_website,
          COALESCE(j.company_location, j.location, rp.location) AS company_location
         FROM jobs j
         LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
         WHERE ${where} ORDER BY j.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, filters.limit, offset],
      ),
    ]);

    return { jobs: dataRes.rows.map(mapJobRow), total: parseInt(countRes.rows[0].count) };
  },
};

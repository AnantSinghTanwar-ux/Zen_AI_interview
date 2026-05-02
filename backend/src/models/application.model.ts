import pool from '../config/database';
import { PoolClient } from 'pg';

export interface ApplicationAnswer {
  question_id: string;
  answer: string;
}

export type ApplicationStatus =
  | 'applied'
  | 'in_review'
  | 'shortlisted'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected';

export interface Application {
  id: string;
  job_id: string;
  applicant_id: string;
  resume_id: string | null;
  application_answers: ApplicationAnswer[];
  cover_letter: string | null;
  resume_snapshot_url: string | null;
  status: ApplicationStatus;
  status_updated_at: Date;
  created_at: Date;
}

let resumeIdColumnExists: boolean | null = null;
let applicationAnswersColumnExists: boolean | null = null;

async function hasColumn(columnName: 'resume_id' | 'application_answers', client?: PoolClient): Promise<boolean> {
  const cached = columnName === 'resume_id' ? resumeIdColumnExists : applicationAnswersColumnExists;
  if (cached !== null) return cached;

  const db = client ?? pool;
  const { rows } = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'applications'
        AND column_name = $1
      LIMIT 1`,
    [columnName],
  );

  const exists = rows.length > 0;
  if (columnName === 'resume_id') resumeIdColumnExists = exists;
  if (columnName === 'application_answers') applicationAnswersColumnExists = exists;
  return exists;
}

function normalizeAnswers(raw: unknown): ApplicationAnswer[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const questionId = String(item.question_id || '').trim();
      const answer = String(item.answer || '').trim();
      if (!questionId || !answer) return null;
      return { question_id: questionId, answer } as ApplicationAnswer;
    })
    .filter((answer): answer is ApplicationAnswer => Boolean(answer));
}

export const ApplicationModel = {
  async findById(id: string): Promise<Application | null> {
    const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findRecruiterApplicationById(recruiterId: string, applicationId: string): Promise<any | null> {
    const { rows } = await pool.query(
      `SELECT a.*, u.email, ap.name, ap.photo_url, ap.phone, ap.skills, ap.education,
              j.title as job_title, j.location as job_location, j.skills as job_skills,
              COALESCE(r.file_url, a.resume_snapshot_url) as resume_url
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
       JOIN jobs j ON j.id = a.job_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND j.recruiter_id = $2
       LIMIT 1`,
      [applicationId, recruiterId],
    );
    return rows[0] || null;
  },

  async adminFindById(applicationId: string): Promise<any | null> {
    const { rows } = await pool.query(
      `SELECT a.*, u.email, ap.name, ap.photo_url, ap.phone, ap.skills, ap.education,
              j.title as job_title, j.location as job_location, j.skills as job_skills,
              COALESCE(r.file_url, a.resume_snapshot_url) as resume_url
       FROM applications a
       JOIN users u ON u.id = a.applicant_id
       JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
       JOIN jobs j ON j.id = a.job_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1
       LIMIT 1`,
      [applicationId],
    );
    return rows[0] || null;
  },

  async findByJobAndApplicant(
    jobId: string,
    applicantId: string,
    client?: PoolClient,
  ): Promise<Application | null> {
    const db = client ?? pool;
    const { rows } = await db.query('SELECT * FROM applications WHERE job_id = $1 AND applicant_id = $2', [
      jobId,
      applicantId,
    ]);
    return rows[0] || null;
  },

  async countByJob(jobId: string, client?: PoolClient): Promise<number> {
    const db = client ?? pool;
    const { rows } = await db.query('SELECT COUNT(*) FROM applications WHERE job_id = $1', [jobId]);
    return Number.parseInt(rows[0]?.count ?? '0', 10);
  },

  async create(
    data: {
      job_id: string;
      applicant_id: string;
      resume_id?: string;
      application_answers?: ApplicationAnswer[];
      cover_letter?: string;
      resume_snapshot_url?: string;
    },
    client?: PoolClient,
  ): Promise<Application> {
    const db = client ?? pool;
    const hasResumeId = await hasColumn('resume_id', client);
    const hasAnswers = await hasColumn('application_answers', client);
    const answers = normalizeAnswers(data.application_answers);

    const columns = ['job_id', 'applicant_id', 'cover_letter', 'resume_snapshot_url'];
    const values: unknown[] = [
      data.job_id,
      data.applicant_id,
      data.cover_letter || null,
      data.resume_snapshot_url || null,
    ];

    if (hasResumeId) {
      columns.push('resume_id');
      values.push(data.resume_id || null);
    }

    if (hasAnswers) {
      columns.push('application_answers');
      values.push(JSON.stringify(answers));
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(',');
    const { rows } = await db.query(
      `INSERT INTO applications (${columns.join(', ')})
       VALUES (${placeholders}) RETURNING *`,
      values,
    );
    return rows[0];
  },

  async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const { rows } = await pool.query(
      `UPDATE applications SET status = $1, status_updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return rows[0];
  },

  async findByApplicant(
    applicantId: string,
    page = 1,
    limit = 20,
  ): Promise<{ applications: Application[]; total: number }> {
    const offset = (page - 1) * limit;
    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM applications WHERE applicant_id = $1', [applicantId]),
      pool.query(
        `SELECT a.*, j.title as job_title, j.location, rp.company_name
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
         WHERE a.applicant_id = $1
         ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
        [applicantId, limit, offset],
      ),
    ]);
    return { applications: dataRes.rows, total: parseInt(countRes.rows[0].count) };
  },

  async findByJob(
    jobId: string,
    page = 1,
    limit = 20,
  ): Promise<{ applications: Application[]; total: number }> {
    const offset = (page - 1) * limit;
    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM applications WHERE job_id = $1', [jobId]),
      pool.query(
        `SELECT a.*, ap.name, ap.photo_url, ap.skills
         FROM applications a
         JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
         WHERE a.job_id = $1
         ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
        [jobId, limit, offset],
      ),
    ]);
    return { applications: dataRes.rows, total: parseInt(countRes.rows[0].count) };
  },

  async findByApplicantWithFilters(
    applicantId: string,
    filters: { status?: ApplicationStatus; jobTitle?: string },
    page = 1,
    limit = 20,
  ): Promise<{ applications: any[]; total: number }> {
    const offset = (page - 1) * limit;
    let query = `
      SELECT a.*, j.title as job_title, j.location, j.type, j.salary_min, j.salary_max,
             rp.company_name, rp.industry
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      LEFT JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
      WHERE a.applicant_id = $1
    `;
    const params: any[] = [applicantId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.jobTitle) {
      query += ` AND j.title ILIKE $${paramIndex}`;
      params.push(`%${filters.jobTitle}%`);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const countQuery = query.replace(/LIMIT \$\d+ OFFSET \$\d+$/, '');
    const countSql = `SELECT COUNT(*) FROM (${countQuery}) as counted`;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, params.slice(-2)),
      pool.query(query, params),
    ]);

    return { applications: dataRes.rows, total: Number.parseInt(countRes.rows[0].count) };
  },

  async getApplicationStats(applicantId: string): Promise<{
    total: number;
    applied: number;
    in_review: number;
    shortlisted: number;
    interview: number;
    offer: number;
    hired: number;
    rejected: number;
  }> {
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) as total,
       SUM(CASE WHEN status = 'APPLIED' THEN 1 ELSE 0 END) as applied,
         SUM(CASE WHEN status = 'SCREENING' THEN 1 ELSE 0 END) as in_review,
         SUM(CASE WHEN status = 'SHORTLISTED' THEN 1 ELSE 0 END) as shortlisted,
         SUM(CASE WHEN status = 'INTERVIEW' THEN 1 ELSE 0 END) as interview,
         SUM(CASE WHEN status = 'SELECTED' THEN 1 ELSE 0 END) as offer,
         SUM(CASE WHEN status = 'HIRED' THEN 1 ELSE 0 END) as hired,
         SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
       FROM applications
       WHERE applicant_id = $1`,
      [applicantId],
    );
    return {
      total: Number.parseInt(rows[0].total || 0),
      applied: Number.parseInt(rows[0].applied || 0),
      in_review: Number.parseInt(rows[0].in_review || 0),
      shortlisted: Number.parseInt(rows[0].shortlisted || 0),
      interview: Number.parseInt(rows[0].interview || 0),
      offer: Number.parseInt(rows[0].offer || 0),
      hired: Number.parseInt(rows[0].hired || 0),
      rejected: Number.parseInt(rows[0].rejected || 0),
    };
  },

  async findByRecruiter(
    recruiterId: string,
    page = 1,
    limit = 20,
  ): Promise<{ applications: any[]; total: number }> {
    const offset = (page - 1) * limit;
    const [countRes, dataRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM applications a
         JOIN jobs j ON j.id = a.job_id
         WHERE j.recruiter_id = $1`,
        [recruiterId],
      ),
      pool.query(
        `SELECT a.*, u.email, ap.name, ap.photo_url, ap.phone, ap.skills, ap.education,
                j.title as job_title, j.location as job_location
         FROM applications a
         JOIN users u ON u.id = a.applicant_id
         JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
         JOIN jobs j ON j.id = a.job_id
         WHERE j.recruiter_id = $1
         ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
        [recruiterId, limit, offset],
      ),
    ]);
    return { applications: dataRes.rows, total: Number.parseInt(countRes.rows[0].count) };
  },

  async findByRecruiterWithFilters(
    recruiterId: string,
    filters: { status?: ApplicationStatus; jobTitle?: string; applicantName?: string; jobId?: string; search?: string },
    page = 1,
    limit = 20,
  ): Promise<{ applications: any[]; total: number }> {
    const offset = (page - 1) * limit;
    let query = `
      SELECT a.*, u.email, ap.name, ap.photo_url, ap.phone, ap.skills, ap.education,
             j.title as job_title, j.location as job_location
      FROM applications a
      JOIN users u ON u.id = a.applicant_id
      JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
      JOIN jobs j ON j.id = a.job_id
      WHERE j.recruiter_id = $1
    `;
    const params: any[] = [recruiterId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.jobTitle) {
      query += ` AND j.title ILIKE $${paramIndex}`;
      params.push(`%${filters.jobTitle}%`);
      paramIndex++;
    }

    if (filters.applicantName) {
      query += ` AND ap.name ILIKE $${paramIndex}`;
      params.push(`%${filters.applicantName}%`);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (j.title ILIKE $${paramIndex} OR ap.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.jobId) {
      query += ` AND j.id = $${paramIndex}`;
      params.push(filters.jobId);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const countQuery = query.replace(/LIMIT \$\d+ OFFSET \$\d+$/, '');
    const countSql = `SELECT COUNT(*) FROM (${countQuery}) as counted`;
    const countParams = params.slice(0, -2); // all params except limit and offset

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, countParams),
      pool.query(query, params),
    ]);

    return { applications: dataRes.rows, total: Number.parseInt(countRes.rows[0].count) };
  },

  async adminFindAllWithFilters(
    filters: { status?: ApplicationStatus; jobTitle?: string; applicantName?: string; jobId?: string; search?: string },
    page = 1,
    limit = 20,
  ): Promise<{ applications: any[]; total: number }> {
    const offset = (page - 1) * limit;
    let query = `
      SELECT a.*, u.email, ap.name, ap.photo_url, ap.phone, ap.skills, ap.education,
             j.title as job_title, j.location as job_location
      FROM applications a
      JOIN users u ON u.id = a.applicant_id
      JOIN applicant_profiles ap ON ap.user_id = a.applicant_id
      JOIN jobs j ON j.id = a.job_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.jobTitle) {
      query += ` AND j.title ILIKE $${paramIndex}`;
      params.push(`%${filters.jobTitle}%`);
      paramIndex++;
    }

    if (filters.applicantName) {
      query += ` AND ap.name ILIKE $${paramIndex}`;
      params.push(`%${filters.applicantName}%`);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (j.title ILIKE $${paramIndex} OR ap.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.jobId) {
      query += ` AND j.id = $${paramIndex}`;
      params.push(filters.jobId);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const countQuery = query.replace(/LIMIT \$\d+ OFFSET \$\d+$/, '');
    const countSql = `SELECT COUNT(*) FROM (${countQuery}) as counted`;
    const countParams = params.slice(0, -2);

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, countParams),
      pool.query(query, params),
    ]);

    return { applications: dataRes.rows, total: Number.parseInt(countRes.rows[0].count) };
  },

  async getRecruiterApplicationStats(recruiterId: string): Promise<{
    total: number;
    applied: number;
    in_review: number;
    shortlisted: number;
    interview: number;
    offer: number;
    hired: number;
    rejected: number;
  }> {
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN a.status = 'applied' THEN 1 ELSE 0 END) as applied,
         SUM(CASE WHEN a.status = 'in_review' THEN 1 ELSE 0 END) as in_review,
         SUM(CASE WHEN a.status = 'shortlisted' THEN 1 ELSE 0 END) as shortlisted,
         SUM(CASE WHEN a.status = 'interview' THEN 1 ELSE 0 END) as interview,
         SUM(CASE WHEN a.status = 'offer' THEN 1 ELSE 0 END) as offer,
         SUM(CASE WHEN a.status = 'hired' THEN 1 ELSE 0 END) as hired,
         SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE j.recruiter_id = $1`,
      [recruiterId],
    );
    return {
      total: Number.parseInt(rows[0].total || 0),
      applied: Number.parseInt(rows[0].applied || 0),
      in_review: Number.parseInt(rows[0].in_review || 0),
      shortlisted: Number.parseInt(rows[0].shortlisted || 0),
      interview: Number.parseInt(rows[0].interview || 0),
      offer: Number.parseInt(rows[0].offer || 0),
      hired: Number.parseInt(rows[0].hired || 0),
      rejected: Number.parseInt(rows[0].rejected || 0),
    };
  },
};

import pool from '../config/database';
import { PoolClient } from 'pg';
import { withTransaction } from '../utils/transaction';

export interface ResumeRow {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

/** List/detail API shape (no user_id, no updated_at). */
export type ResumeListItem = Omit<ResumeRow, 'user_id' | 'updated_at'>;
export type ResumeDeleteResult = {
  deletedId: string;
  deletedUrl: string;
  newDefault: ResumeListItem | null;
};

export const ResumeModel = {
  async findByUserId(userId: string): Promise<ResumeListItem[]> {
    const { rows } = await pool.query(
      `SELECT id, file_url, file_name, file_size, mime_type, is_default, created_at
       FROM resumes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  },

  async findByUserAndId(userId: string, resumeId: string): Promise<ResumeListItem | null> {
    const { rows } = await pool.query(
      `SELECT id, file_url, file_name, file_size, mime_type, is_default, created_at
       FROM resumes
       WHERE user_id = $1 AND id = $2
       LIMIT 1`,
      [userId, resumeId],
    );
    return rows[0] || null;
  },

  async findDefaultByUserId(userId: string): Promise<ResumeRow | null> {
    const { rows } = await pool.query(
      `SELECT id, user_id, file_url, file_name, file_size, mime_type, is_default, created_at, updated_at
       FROM resumes WHERE user_id = $1 AND is_default = TRUE LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  },

  async hasAnyResume(userId: string): Promise<boolean> {
    const { rows } = await pool.query(`SELECT 1 FROM resumes WHERE user_id = $1 LIMIT 1`, [userId]);
    return rows.length > 0;
  },

  /**
   * Clears other defaults and inserts the new default resume (single transaction).
   * DB partial unique index unique_default_resume_per_user prevents two defaults per user if races occur.
   */
  async createDefaultForUser(
    userId: string,
    data: {
      file_url: string;
      file_name: string;
      file_size: number;
      mime_type: string;
    },
  ): Promise<ResumeRow> {
    return withTransaction(async (client: PoolClient) => {
      await client.query(`UPDATE resumes SET is_default = FALSE WHERE user_id = $1`, [userId]);
      const { rows } = await client.query(
        `INSERT INTO resumes (user_id, file_url, file_name, file_size, mime_type, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
         RETURNING id, user_id, file_url, file_name, file_size, mime_type, is_default, created_at, updated_at`,
        [userId, data.file_url, data.file_name, data.file_size, data.mime_type],
      );
      return rows[0];
    });
  },

  async setDefaultResume(
    userId: string,
    resumeId: string,
    client?: PoolClient,
  ): Promise<ResumeListItem> {
    const db = client ?? pool;

    // Lock target row for this user to avoid concurrent default-switch races.
    const { rows: targetRows } = await db.query(
      `SELECT id FROM resumes WHERE user_id = $1 AND id = $2 FOR UPDATE`,
      [userId, resumeId],
    );
    if (targetRows.length === 0) {
      throw Object.assign(new Error('Resume not found for this user'), {
        statusCode: 404,
        code: 'RESUME_NOT_FOUND',
      });
    }

    await db.query(`UPDATE resumes SET is_default = FALSE WHERE user_id = $1`, [userId]);

    const { rows: updatedRows } = await db.query(
      `UPDATE resumes
       SET is_default = TRUE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, file_url, file_name, file_size, mime_type, is_default, created_at`,
      [resumeId, userId],
    );

    return updatedRows[0];
  },

  async deleteResume(
    userId: string,
    resumeId: string,
    client?: PoolClient,
  ): Promise<ResumeDeleteResult> {
    const db = client ?? pool;

    // Lock all user resumes so delete + optional reassignment are race-safe.
    const { rows: resumes } = await db.query(
      `SELECT id, file_url, is_default FROM resumes WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    if (resumes.length === 0) {
      throw Object.assign(new Error('Resume not found'), {
        statusCode: 404,
        code: 'RESUME_NOT_FOUND',
      });
    }

    const target = resumes.find((row: { id: string }) => row.id === resumeId) as
      | { id: string; file_url: string; is_default: boolean }
      | undefined;
    if (!target) {
      throw Object.assign(new Error('Resume not found'), {
        statusCode: 404,
        code: 'RESUME_NOT_FOUND',
      });
    }

    // Product guard: keep at least one resume for each applicant.
    if (resumes.length === 1) {
      throw Object.assign(new Error('At least one resume is required'), {
        statusCode: 409,
        code: 'LAST_RESUME_REQUIRED',
      });
    }

    await db.query(`DELETE FROM resumes WHERE id = $1 AND user_id = $2`, [resumeId, userId]);

    let newDefault: ResumeListItem | null = null;
    if (target.is_default) {
      const { rows: remaining } = await db.query(
        `SELECT id, file_url, file_name, file_size, mime_type, is_default, created_at
         FROM resumes
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId],
      );

      if (remaining.length > 0) {
        const newId = remaining[0].id as string;
        await db.query(`UPDATE resumes SET is_default = TRUE, updated_at = NOW() WHERE id = $1`, [newId]);
        newDefault = { ...remaining[0], is_default: true };
      }
    }

    return {
      deletedId: resumeId,
      deletedUrl: target.file_url,
      newDefault,
    };
  },
};

import pool from '../config/database';
import { PoolClient } from 'pg';
import { ApplicationStatus } from './application.model';

export interface PipelineEvent {
  id: string;
  application_id: string;
  previous_status: ApplicationStatus | null;
  new_status: ApplicationStatus;
  changed_by_id: string | null;
  notes: string | null;
  created_at: Date;
}

export const PipelineEventModel = {
  async create(
    data: {
      application_id: string;
      previous_status?: ApplicationStatus | null;
      new_status: ApplicationStatus;
      changed_by_id?: string | null;
      notes?: string | null;
    },
    client?: PoolClient,
  ): Promise<PipelineEvent> {
    const db = client ?? pool;
    const { rows } = await db.query(
      `INSERT INTO pipeline_events (application_id, previous_status, new_status, changed_by_id, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.application_id,
        data.previous_status || null,
        data.new_status,
        data.changed_by_id || null,
        data.notes || null,
      ],
    );
    return rows[0];
  },

  async findByApplication(applicationId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT pe.*, u.role as changer_role, u.email as changer_email, 
              ap.name as applicant_name, rp.name as recruiter_name
       FROM pipeline_events pe
       LEFT JOIN users u ON u.id = pe.changed_by_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = u.id
       LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
       WHERE pe.application_id = $1
       ORDER BY pe.created_at ASC`,
      [applicationId]
    );

    // Map the user info into a nested structure for the frontend
    return rows.map((row) => {
      let changed_by = null;
      if (row.changed_by_id) {
        changed_by = {
          id: row.changed_by_id,
          role: row.changer_role,
          name: row.changer_role === 'applicant' ? row.applicant_name : row.recruiter_name,
        };
      }
      return {
        id: row.id,
        application_id: row.application_id,
        previous_status: row.previous_status,
        new_status: row.new_status,
        notes: row.notes,
        created_at: row.created_at,
        changed_by,
      };
    });
  },
};

import pool from '../config/database';

export interface RecruiterProfile {
  id: string;
  user_id: string;
  name: string | null;
  company_name: string | null;
  company_email: string | null;
  industry: string | null;
  description: string | null;
  company_size: string | null;
  logo_url: string | null;
  website: string | null;
  location: string | null;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export const RecruiterProfileModel = {
  async findByUserId(userId: string): Promise<RecruiterProfile | null> {
    const { rows } = await pool.query('SELECT * FROM recruiter_profiles WHERE user_id = $1', [
      userId,
    ]);
    return rows[0] || null;
  },

  async create(userId: string): Promise<RecruiterProfile> {
    const { rows } = await pool.query(
      `INSERT INTO recruiter_profiles (user_id, updated_at) VALUES ($1, NOW()) RETURNING *`,
      [userId],
    );
    return rows[0];
  },

  async update(
    userId: string,
    data: Partial<Omit<RecruiterProfile, 'user_id' | 'created_at' | 'updated_at'>>,
  ): Promise<RecruiterProfile> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE recruiter_profiles SET ${setClause}, updated_at = NOW() WHERE user_id = $${fields.length + 1} RETURNING *`,
      [...values, userId],
    );
    return rows[0];
  },
};

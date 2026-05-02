import pool from '../config/database';

export interface ApplicantProfile {
  user_id: string;
  name: string | null;
  phone: string | null;
  photo_url: string | null;
  skills: string[];
  experience: object[];
  education: object[];
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
}

export const ApplicantProfileModel = {
  async findByUserId(userId: string): Promise<ApplicantProfile | null> {
    const { rows } = await pool.query('SELECT * FROM applicant_profiles WHERE user_id = $1', [
      userId,
    ]);
    return rows[0] || null;
  },

  async create(userId: string): Promise<ApplicantProfile> {
    const { rows } = await pool.query(
      `INSERT INTO applicant_profiles (user_id) VALUES ($1) RETURNING *`,
      [userId],
    );
    return rows[0];
  },

  async update(
    userId: string,
    data: Partial<Omit<ApplicantProfile, 'user_id' | 'created_at' | 'updated_at'>>,
  ): Promise<ApplicantProfile> {
    const fields = Object.keys(data);
    const values = fields.map((field) => {
      const value = (data as Record<string, unknown>)[field];
      if ((field === 'experience' || field === 'education') && value !== undefined) {
        return JSON.stringify(value);
      }
      return value;
    });
    const setClause = fields
      .map((f, i) =>
        f === 'experience' || f === 'education'
          ? `${f} = $${i + 1}::jsonb`
          : `${f} = $${i + 1}`,
      )
      .join(', ');
    const { rows } = await pool.query(
      `UPDATE applicant_profiles SET ${setClause}, updated_at = NOW() WHERE user_id = $${fields.length + 1} RETURNING *`,
      [...values, userId],
    );
    return rows[0];
  },
};

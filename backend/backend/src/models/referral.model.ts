import pool from '../config/database';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referrer_credited: boolean;
  referred_credited: boolean;
  created_at: Date;
}

export const ReferralModel = {
  async create(referrerId: string, referredId: string): Promise<Referral> {
    const { rows } = await pool.query(
      `INSERT INTO referrals (referrer_id, referred_id) VALUES ($1,$2) RETURNING *`,
      [referrerId, referredId],
    );
    return rows[0];
  },

  async findByReferredId(referredId: string): Promise<Referral | null> {
    const { rows } = await pool.query('SELECT * FROM referrals WHERE referred_id = $1', [
      referredId,
    ]);
    return rows[0] || null;
  },

  async findByReferrerId(referrerId: string): Promise<Referral[]> {
    const { rows } = await pool.query(
      `SELECT r.*, u.email, ap.name FROM referrals r
       JOIN users u ON u.id = r.referred_id
       LEFT JOIN applicant_profiles ap ON ap.user_id = r.referred_id
       WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
      [referrerId],
    );
    return rows;
  },

  async markReferrerCredited(id: string): Promise<void> {
    await pool.query(`UPDATE referrals SET referrer_credited = TRUE WHERE id = $1`, [id]);
  },

  async markReferredCredited(id: string): Promise<void> {
    await pool.query(`UPDATE referrals SET referred_credited = TRUE WHERE id = $1`, [id]);
  },
};

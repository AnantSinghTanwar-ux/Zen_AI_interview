import pool from '../config/database';

export interface ReferralRedemption {
  id: string;
  user_id: string;
  referrer_id: string;
  created_at: Date;
}

export const ReferralRedemptionModel = {
  async create(userId: string, referrerId: string): Promise<ReferralRedemption> {
    const { rows } = await pool.query(
      `INSERT INTO referral_redemptions (user_id, referrer_id) VALUES ($1, $2) RETURNING *`,
      [userId, referrerId],
    );
    return rows[0];
  },

  async findByUserId(userId: string): Promise<ReferralRedemption | null> {
    const { rows } = await pool.query(
      `SELECT * FROM referral_redemptions WHERE user_id = $1`,
      [userId],
    );
    return rows[0] || null;
  },

  async findByReferrerId(referrerId: string): Promise<ReferralRedemption[]> {
    const { rows } = await pool.query(
      `SELECT * FROM referral_redemptions WHERE referrer_id = $1 ORDER BY created_at DESC`,
      [referrerId],
    );
    return rows;
  },
};

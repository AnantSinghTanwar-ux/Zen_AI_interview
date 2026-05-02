import pool from '../config/database';
import { PoolClient } from 'pg';

export type NotificationType =
  | 'job_match'
  | 'application_status'
  | 'new_message'
  | 'referral_joined'
  | 'low_credit'
  | 'payment_success'
  | 'payment_failed'
  | 'application_submitted';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  action_url: string | null;
  created_at: Date;
}

export const NotificationModel = {
  async create(data: {
    user_id: string;
    type: NotificationType;
    title: string;
    body: string;
    action_url?: string;
  }, client?: PoolClient): Promise<Notification> {
    const db = client ?? pool;
    const { rows } = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, action_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.user_id, data.type, data.title, data.body, data.action_url || null],
    );
    return rows[0];
  },

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: Notification[]; total: number; unread: number }> {
    const offset = (page - 1) * limit;
    const [countRes, unreadRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE', [
        userId,
      ]),
      pool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
    ]);
    return {
      notifications: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      unread: parseInt(unreadRes.rows[0].count),
    };
  },

  async markRead(id: string, userId: string): Promise<void> {
    await pool.query(`UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);
  },

  async markAllRead(userId: string): Promise<void> {
    await pool.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [userId]);
  },
};

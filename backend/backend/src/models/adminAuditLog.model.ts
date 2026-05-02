import pool from '../config/database';

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  created_at: Date;
}

export const AdminAuditLogModel = {
  async create(data: {
    admin_id: string;
    action: string;
    target_type?: string;
    target_id?: string;
    reason?: string;
  }): Promise<AdminAuditLog> {
    const { rows } = await pool.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        data.admin_id,
        data.action,
        data.target_type || null,
        data.target_id || null,
        data.reason || null,
      ],
    );
    return rows[0];
  },

  async findAll(page = 1, limit = 50): Promise<{ logs: AdminAuditLog[]; total: number }> {
    const offset = (page - 1) * limit;
    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM admin_audit_log'),
      pool.query(
        `SELECT l.*, u.email AS admin_email
         FROM admin_audit_log l
         JOIN users u ON u.id = l.admin_id
         ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);
    return { logs: dataRes.rows, total: parseInt(countRes.rows[0].count) };
  },
};

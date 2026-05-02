import pool from '../config/database';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

export interface Plan {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
}

export interface Payment {
  id: string;
  user_id: string;
  plan_id: string | null;
  amount: number;
  currency: string;
  gateway_ref: string | null;
  status: PaymentStatus;
  created_at: Date;
}

const DEFAULT_PLANS: Array<{ name: string; credits: number; price: number; currency: string }> = [
  { name: 'Starter', credits: 60, price: 59, currency: 'INR' },
  { name: 'Pro', credits: 150, price: 119, currency: 'INR' },
  { name: 'Premium', credits: 250, price: 179, currency: 'INR' },
];

export const PaymentModel = {
  async ensureDefaultPlans(): Promise<void> {
    const { rows } = await pool.query(
      `SELECT 1 FROM plans WHERE is_active = TRUE LIMIT 1`,
    );

    if (rows.length > 0) {
      return;
    }

    for (const plan of DEFAULT_PLANS) {
      await pool.query(
        `INSERT INTO plans (name, credits, price, currency, is_active)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [plan.name, plan.credits, plan.price, plan.currency],
      );
    }
  },

  async getActivePlans(): Promise<Plan[]> {
    const { rows } = await pool.query(
      `SELECT * FROM plans WHERE is_active = TRUE ORDER BY price ASC`,
    );
    return rows;
  },

  async findPlanById(id: string): Promise<Plan | null> {
    const { rows } = await pool.query('SELECT * FROM plans WHERE id = $1 AND is_active = TRUE', [
      id,
    ]);
    return rows[0] || null;
  },

  async createPayment(data: {
    user_id: string;
    plan_id: string;
    amount: number;
    currency: string;
    gateway_ref?: string;
  }): Promise<Payment> {
    const { rows } = await pool.query(
      `INSERT INTO payments (user_id, plan_id, amount, currency, gateway_ref)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.user_id, data.plan_id, data.amount, data.currency, data.gateway_ref || null],
    );
    return rows[0];
  },

  async updateStatus(id: string, status: PaymentStatus, gatewayRef?: string): Promise<Payment> {
    const { rows } = await pool.query(
      `UPDATE payments SET status = $1, gateway_ref = COALESCE($2, gateway_ref) WHERE id = $3 RETURNING *`,
      [status, gatewayRef || null, id],
    );
    return rows[0];
  },

  async findByGatewayRef(ref: string): Promise<Payment | null> {
    const { rows } = await pool.query('SELECT * FROM payments WHERE gateway_ref = $1', [ref]);
    return rows[0] || null;
  },

  async getHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ payments: Payment[]; total: number }> {
    const offset = (page - 1) * limit;
    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM payments WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT p.*, pl.name as plan_name FROM payments p LEFT JOIN plans pl ON pl.id = p.plan_id
         WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
    ]);
    return { payments: dataRes.rows, total: parseInt(countRes.rows[0].count) };
  },
};

import pool from '../config/database';
import { PoolClient } from 'pg';

export type CreditType = 'credit' | 'debit';
export type CreditStatus = 'success' | 'failed';

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: CreditType;
  amount: number;
  status: CreditStatus;
  balance_after: number;
  description: string;
  reference_id: string | null;
  created_at: Date;
}

/** Ledger row for API / history (excludes user_id). */
export type CreditLedgerEntry = Omit<CreditTransaction, 'user_id'>;

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

let statusColumnCache: boolean | null = null;

const hasStatusColumn = async (db: Queryable): Promise<boolean> => {
  if (statusColumnCache !== null) return statusColumnCache;

  const { rows } = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'credit_transactions'
       AND column_name = 'status'
     LIMIT 1`,
  );

  statusColumnCache = rows.length > 0;
  return statusColumnCache;
};

export const CreditModel = {
  /** Returns null if no user row exists (caller / service decides how to handle). */
  async getBalance(userId: string): Promise<number | null> {
    const { rows } = await pool.query('SELECT credit_balance FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return null;
    return rows[0].credit_balance;
  },

  async getHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ transactions: CreditLedgerEntry[]; total: number }> {
    const offset = (page - 1) * limit;
    const statusExists = await hasStatusColumn(pool);
    const selectStatus = statusExists ? 'status' : `'success'::varchar AS status`;

    const [countRes, dataRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM credit_transactions WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT id, type, amount, ${selectStatus}, balance_after, description, reference_id, created_at
         FROM credit_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
    ]);
    return { transactions: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
  },

  // Atomically debit/credit and record transaction — must be called inside a DB transaction
  async record(
    client: PoolClient,
    data: {
      user_id: string;
      type: CreditType;
      amount: number;
      status?: CreditStatus;
      balance_after: number;
      description: string;
      reference_id?: string;
    },
  ): Promise<CreditTransaction> {
    const statusExists = await hasStatusColumn(client);
    const { rows } = statusExists
      ? await client.query(
          `INSERT INTO credit_transactions (user_id, type, amount, status, balance_after, description, reference_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            data.user_id,
            data.type,
            data.amount,
            data.status ?? 'success',
            data.balance_after,
            data.description,
            data.reference_id || null,
          ],
        )
      : await client.query(
          `INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, reference_id)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *, 'success'::varchar AS status`,
          [
            data.user_id,
            data.type,
            data.amount,
            data.balance_after,
            data.description,
            data.reference_id || null,
          ],
        );

    return rows[0];
  },
};

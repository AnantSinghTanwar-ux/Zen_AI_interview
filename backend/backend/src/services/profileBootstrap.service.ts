import prisma from '../config/prisma';
import pool from '../config/database';
import { UserRole } from '../types';

export const ProfileBootstrapService = {
  async ensureRoleProfile(userId: string, role: UserRole): Promise<void> {
    if (role === 'applicant') {
      await prisma.applicant_profiles.upsert({
        where: { user_id: userId },
        update: {},
        create: { user_id: userId },
      });
      return;
    }

    if (role === 'recruiter') {
      await prisma.recruiter_profiles.upsert({
        where: { user_id: userId },
        update: {},
        create: { user_id: userId },
      });
    }
  },

  async ensureRoleProfileWithSql(userId: string, role: UserRole): Promise<void> {
    if (role === 'applicant') {
      await pool.query(
        `INSERT INTO applicant_profiles (user_id, created_at, updated_at)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      return;
    }

    if (role === 'recruiter') {
      await pool.query(
        `INSERT INTO recruiter_profiles (user_id, created_at, updated_at)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
    }
  },
};

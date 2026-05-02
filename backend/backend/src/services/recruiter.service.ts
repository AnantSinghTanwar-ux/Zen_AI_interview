import prisma from '../config/prisma';
import { conflict } from '../utils/appError';
import { RecruiterProfile } from '../models/recruiterProfile.model';

export const RecruiterService = {
  /**
   * Update an existing recruiter profile
   *
   * - Supports partial updates (only provided fields are updated)
   * - If company_email is provided, checks for uniqueness against other profiles
   * - Uses Prisma for safe update with type checking
   *
   * @param userId - The recruiter user's ID
   * @param data - Partial profile data to update
   * @returns Updated profile
   * @throws {AppError} 409 if company_email is already in use by another recruiter
   * @throws {AppError} 400 for database constraint violations
   */
  async updateRecruiterProfile(
    userId: string,
    data: Partial<{
      company_name: string;
      company_email: string;
      industry: string;
      description: string;
      company_size: string;
      website: string;
      location: string;
      logo_url: string;
    }>,
  ): Promise<RecruiterProfile> {
    // Step 1: If company_email is provided, check for uniqueness
    if (data.company_email) {
      const existingEmail = await (prisma.recruiter_profiles as any).findFirst({
        where: { company_email: data.company_email } as any,
      });

      // Email is taken by another recruiter
      if (existingEmail && existingEmail.user_id !== userId) {
        throw conflict('Company email is already in use');
      }
    }

    // Step 2: Update profile with Prisma
    try {
      const profile = await (prisma.recruiter_profiles as any).update({
        where: { user_id: userId },
        data,
      });

      return profile as unknown as RecruiterProfile;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };

      // PostgreSQL unique constraint violation (23505)
      if (error.code === '23505') {
        if (error.message?.includes('company_email')) {
          throw conflict('Company email is already in use');
        }
      }

      throw err;
    }
  },

  /**
   * Create a new recruiter profile
   *
   * - Check if recruiter already has a profile (only one profile per recruiter allowed)
   * - If exists: throw conflict error (409)
   * - If not exists: create profile with provided data
   *
   * @param userId - The recruiter user's ID
   * @param data - Profile data (company_name, company_email, etc.)
   * @returns Created profile
   * @throws {AppError} 409 if profile already exists
   * @throws {AppError} 400 for duplicate company_email
   */
  async createRecruiterProfile(
    userId: string,
    data: {
      company_name?: string;
      company_email?: string;
      industry?: string;
      description?: string;
      company_size?: string;
      website?: string;
      location?: string;
    },
  ): Promise<RecruiterProfile> {
    // Step 1: Check if recruiter profile already exists
    const existingProfile = await prisma.recruiter_profiles.findUnique({
      where: { user_id: userId },
    });

    if (existingProfile) {
      throw conflict('Recruiter profile already exists. Use PUT to update.');
    }

    // Step 2: Check for duplicate company_email if provided
    if (data.company_email) {
      const duplicateEmail = await (prisma.recruiter_profiles as any).findFirst({
        where: { company_email: data.company_email },
      });

      if (duplicateEmail) {
        throw conflict('Company email is already in use');
      }
    }

    // Step 3: Create recruiter profile
    try {
      const profile = await (prisma.recruiter_profiles as any).create({
        data: {
          user_id: userId,
          name: data.company_name, // Store company name as profile name initially
          company_name: data.company_name,
          company_email: data.company_email,
          industry: data.industry,
          description: data.description,
          company_size: data.company_size,
          website: data.website,
          location: data.location,
          is_verified: false, // Default to unverified
        },
      });

      return profile as unknown as RecruiterProfile;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };

      // PostgreSQL unique constraint violation (23505)
      if (error.code === '23505') {
        if (error.message?.includes('user_id')) {
          throw conflict('Recruiter profile already exists');
        }
        if (error.message?.includes('company_email')) {
          throw conflict('Company email is already in use');
        }
      }

      throw err;
    }
  },

  /**
   * Convert an applicant user to a recruiter
   * 
   * - Updates user role from 'applicant' to 'recruiter'
   * - Creates a new recruiter profile with provided details
   * - Atomically handles both operations
   *
   * @param userId - The user's ID to convert
   * @param data - Profile data (company_name, company_email, etc.)
   * @returns Created recruiter profile
   * @throws {AppError} 400 if user is already a recruiter
   * @throws {AppError} 409 if profile already exists or email in use
   */

};

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('local', 'google', 'github', 'linkedin');
CREATE TYPE "application_status" AS ENUM ('applied', 'in_review', 'shortlisted', 'interview', 'offer', 'hired', 'rejected');
CREATE TYPE "credit_type" AS ENUM ('credit', 'debit');
CREATE TYPE "job_status" AS ENUM ('draft', 'active', 'closed');
CREATE TYPE "job_type" AS ENUM ('full-time', 'part-time', 'contract', 'remote', 'internship');
CREATE TYPE "notification_type" AS ENUM ('job_match', 'application_status', 'new_message', 'referral_joined', 'low_credit', 'payment_success', 'payment_failed', 'application_submitted');
CREATE TYPE "payment_status" AS ENUM ('pending', 'success', 'failed', 'refunded');
CREATE TYPE "user_role" AS ENUM ('applicant', 'recruiter', 'admin');

-- Create all tables as in the migration...
-- (Tables will be created from the migration.sql file contents)

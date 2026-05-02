-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "fk_jobs_approved_by";

-- DropIndex
DROP INDEX "idx_referral_redemptions_user_id";

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "job_approval_status" DROP NOT NULL;

-- RenameIndex
ALTER INDEX "idx_referral_redemptions_referrer_id" RENAME TO "idx_referral_redemptions_referrer";

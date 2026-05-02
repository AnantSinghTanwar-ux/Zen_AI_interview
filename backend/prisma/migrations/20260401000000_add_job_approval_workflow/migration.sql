-- Add job approval workflow columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_approval_status VARCHAR(30) DEFAULT 'approved' NOT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_jobs_approval_status ON jobs(job_approval_status);

-- Update existing jobs based on source
UPDATE jobs SET job_approval_status = 'approved' WHERE source IN ('admin_external', 'admin_company') OR source IS NULL;
UPDATE jobs SET job_approval_status = 'pending_approval' WHERE source = 'recruiter' AND status != 'draft';

-- Add foreign key constraint for approved_by
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

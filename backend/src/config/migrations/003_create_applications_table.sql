-- Migration 003: Create applications table

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter        TEXT,
  resume_snapshot_url VARCHAR(500),
  status              application_status DEFAULT 'applied',
  status_updated_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, applicant_id)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_job_applicant ON applications(job_id, applicant_id);

-- Index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_applications_status_created ON applications(status, created_at DESC);

-- Add dynamic recruiter-defined job application questions and applicant answers.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS application_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS resume_id UUID,
  ADD COLUMN IF NOT EXISTS application_answers JSONB NOT NULL DEFAULT '[]'::jsonb;

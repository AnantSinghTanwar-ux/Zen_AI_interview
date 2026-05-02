-- Hiring Platform — PostgreSQL Schema v1.0
-- Run once to initialize the database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text similarity search

-- Enum types
CREATE TYPE user_role AS ENUM ('applicant', 'recruiter', 'admin');
CREATE TYPE auth_provider AS ENUM ('local', 'google', 'github', 'linkedin');
CREATE TYPE job_type AS ENUM ('full-time', 'part-time', 'contract', 'remote', 'internship');
CREATE TYPE job_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE application_status AS ENUM ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED');
CREATE TYPE credit_type AS ENUM ('credit', 'debit');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
CREATE TYPE notification_type AS ENUM (
  'job_match', 'application_status', 'new_message',
  'referral_joined', 'low_credit', 'payment_success', 'payment_failed', 'application_submitted'
);

-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  auth_provider auth_provider NOT NULL DEFAULT 'local',
  google_id     VARCHAR(255) UNIQUE,
  github_id     VARCHAR(255) UNIQUE,
  linkedin_id   VARCHAR(255) UNIQUE,
  role          user_role NOT NULL,
  is_verified   BOOLEAN DEFAULT FALSE,
  verify_token  VARCHAR(255),
  reset_token   VARCHAR(255),
  reset_token_expires_at TIMESTAMPTZ,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  credit_balance INTEGER DEFAULT 0 NOT NULL,
  banned_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Applicant profiles
CREATE TABLE applicant_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255),
  phone         VARCHAR(30),
  photo_url     VARCHAR(500),
  skills        TEXT[] DEFAULT '{}',
  experience    JSONB DEFAULT '[]',
  education     JSONB DEFAULT '[]',
  portfolio_url VARCHAR(500),
  github_url    VARCHAR(500),
  linkedin_url  VARCHAR(500),
  bio           TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Recruiter profiles
CREATE TABLE recruiter_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255),
  company_name  VARCHAR(255),
  industry      VARCHAR(100),
  description   TEXT,
  company_size  VARCHAR(50),
  logo_url      VARCHAR(500),
  website       VARCHAR(500),
  location      VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recruiter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  location      VARCHAR(255),
  salary_min    INTEGER,
  salary_max    INTEGER,
  type          job_type NOT NULL DEFAULT 'full-time',
  skills        TEXT[] DEFAULT '{}',
  application_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  description   TEXT NOT NULL,
  status        job_status DEFAULT 'draft',
  is_boosted    BOOLEAN DEFAULT FALSE,
  views_count   INTEGER DEFAULT 0,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Job search vector (for full-text search)
ALTER TABLE jobs ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

-- Applications
CREATE TABLE applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id              UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id           UUID,
  application_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  cover_letter        TEXT,
  resume_snapshot_url VARCHAR(500),
  status              application_status DEFAULT 'APPLIED',
  status_updated_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, applicant_id)
);

-- Pipeline events
CREATE TABLE pipeline_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  previous_status application_status,
  new_status      application_status NOT NULL,
  changed_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Saved jobs
CREATE TABLE saved_jobs (
  applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (applicant_id, job_id)
);

-- Resumes (S3/CloudFront URL + metadata; multiple per user; is_default for applications)
CREATE TABLE resumes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url    VARCHAR(500) NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_size   INTEGER,
  mime_type   VARCHAR(100),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_default ON resumes (user_id, is_default);

CREATE INDEX idx_resumes_user_created_at ON resumes (user_id, created_at DESC);

-- At most one default per user (complements application-layer clearing in transactions)
CREATE UNIQUE INDEX unique_default_resume_per_user ON resumes (user_id) WHERE (is_default = TRUE);

-- Conversations
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recruiter_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (recruiter_id, applicant_id, job_id)
);

-- Messages
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions (append-only ledger)
CREATE TABLE credit_transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           credit_type NOT NULL,
  amount         INTEGER NOT NULL CHECK (amount > 0),
  status         VARCHAR(20) NOT NULL DEFAULT 'success',
  balance_after  INTEGER NOT NULL,
  description    VARCHAR(255) NOT NULL,
  reference_id   UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals
CREATE TABLE referrals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_credited BOOLEAN DEFAULT FALSE,
  referred_credited BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (referred_id)
);

-- Subscription plans
CREATE TABLE plans (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  credits    INTEGER NOT NULL,
  price      NUMERIC(10, 2) NOT NULL,
  currency   VARCHAR(10) DEFAULT 'INR',
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id     UUID REFERENCES plans(id),
  amount      NUMERIC(10, 2) NOT NULL,
  currency    VARCHAR(10) DEFAULT 'INR',
  gateway_ref VARCHAR(255),
  status      payment_status DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin audit log (immutable)
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   UUID,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_jobs_status_location_type ON jobs (status, location, type) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_recruiter ON jobs (recruiter_id);
CREATE INDEX idx_jobs_search ON jobs USING GIN (search_vector);
CREATE INDEX idx_jobs_skills ON jobs USING GIN (skills);

CREATE INDEX idx_applications_job_status ON applications (job_id, status);
CREATE INDEX idx_applications_applicant ON applications (applicant_id, created_at DESC);

CREATE INDEX idx_credit_tx_user ON credit_transactions (user_id, created_at DESC);

CREATE INDEX idx_notifications_user ON notifications (user_id, read, created_at DESC);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at ASC);

-- ─── Seed: Default subscription plans ─────────────────────────────────────────

INSERT INTO plans (name, credits, price, currency) VALUES
  ('Starter',    200,  499, 'INR'),
  ('Pro',        600,  999, 'INR'),
  ('Enterprise', 1500, 1999,'INR');

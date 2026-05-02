-- Migration 002: add banned_at to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_users_role_created ON users (role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING GIN (email gin_trgm_ops);

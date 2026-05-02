-- ============================================================================
-- HIRING PLATFORM SEED DATA
-- ============================================================================

-- Admin Account
INSERT INTO users (email, password_hash, role, is_verified, referral_code, credit_balance)
VALUES ('admin@hiringplatform.com', '$2b$12$FkbOij02FjKfYlkwmCobX.W6doU8Tf19IbVFUQS7LcLszAoyKvsve', 'admin', TRUE, 'REF_ADMIN_001', 0)
ON CONFLICT (email) DO NOTHING;

-- Recruiter Accounts
INSERT INTO users (email, password_hash, role, is_verified, referral_code, credit_balance)
VALUES 
  ('recruiter1@google.com', '$2b$12$FkbOij02FjKfYlkwmCobX.W6doU8Tf19IbVFUQS7LcLszAoyKvsve', 'recruiter', TRUE, 'REF_REC_001', 50),
  ('recruiter2@microsoft.com', '$2b$12$FkbOij02FjKfYlkwmCobX.W6doU8Tf19IbVFUQS7LcLszAoyKvsve', 'recruiter', TRUE, 'REF_REC_002', 50),
  ('recruiter3@amazon.com', '$2b$12$FkbOij02FjKfYlkwmCobX.W6doU8Tf19IbVFUQS7LcLszAoyKvsve', 'recruiter', TRUE, 'REF_REC_003', 50)
ON CONFLICT (email) DO NOTHING;

-- Applicant Accounts  
INSERT INTO users (email, password_hash, role, is_verified, referral_code, credit_balance)
VALUES
  ('john@example.com', '$2b$12$FkbOij02FjKfYlkwmCobX.W6doU8Tf19IbVFUQS7LcLszAoyKvsve', 'applicant', TRUE, 'REF_APP_001', 50),
  ('jane@example.com', '$2b$12$FkbOij02FjKfYlkwmCobX.W6doU8Tf19IbVFUQS7LcLszAoyKvsve', 'applicant', TRUE, 'REF_APP_002', 50)
ON CONFLICT (email) DO NOTHING;

-- Recruiter Profiles
INSERT INTO recruiter_profiles (user_id, name, company_name, industry, description, updated_at)
SELECT id, 'Alice Chen', 'Google', 'Technology', 'Google is a global technology leader focused on improving the ways people connect with information.', NOW()
FROM users WHERE email = 'recruiter1@google.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO recruiter_profiles (user_id, name, company_name, industry, description, updated_at)
SELECT id, 'Bob Williams', 'Microsoft', 'Technology', 'Microsoft empowers every person and organization on the planet to achieve more through technology.', NOW()
FROM users WHERE email = 'recruiter2@microsoft.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO recruiter_profiles (user_id, name, company_name, industry, description, updated_at)
SELECT id, 'Carol Singh', 'Amazon', 'E-commerce', 'Amazon is guided by four principles: customer obsession, passion for invention, commitment to operational excellence, and long-term thinking.', NOW()
FROM users WHERE email = 'recruiter3@amazon.com'
ON CONFLICT (user_id) DO NOTHING;

-- Applicant Profiles
INSERT INTO applicant_profiles (user_id, name, bio, skills)
SELECT id, 'John Doe', 'Passionate full-stack developer with 3 years of experience building scalable web applications.', ARRAY['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL']
FROM users WHERE email = 'john@example.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO applicant_profiles (user_id, name, bio, skills)
SELECT id, 'Jane Smith', 'Data scientist and ML engineer with expertise in Python, TensorFlow, and large-scale data pipelines.', ARRAY['Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'SQL']
FROM users WHERE email = 'jane@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Sample Jobs (Posted by Google recruiter)
INSERT INTO jobs (recruiter_id, title, location, type, salary_min, salary_max, skills, description, status)
SELECT u.id, 'Senior Software Engineer', 'Mountain View, CA', 'full-time', 180000, 250000, 
  ARRAY['Go', 'Python', 'Kubernetes', 'Distributed Systems', 'SQL'],
  'Join Google infrastructure team to build highly available, planet-scale distributed systems.',
  'active'
FROM users u WHERE u.email = 'recruiter1@google.com'
ON CONFLICT DO NOTHING;

INSERT INTO jobs (recruiter_id, title, location, type, salary_min, salary_max, skills, description, status)
SELECT u.id, 'ML Engineer', 'Remote', 'remote', 160000, 220000,
  ARRAY['Python', 'TensorFlow', 'PyTorch', 'Machine Learning', 'NumPy'],
  'Work on cutting-edge machine learning research with world-class researchers.',
  'active'
FROM users u WHERE u.email = 'recruiter1@google.com'
ON CONFLICT DO NOTHING;

INSERT INTO jobs (recruiter_id, title, location, type, salary_min, salary_max, skills, description, status)
SELECT u.id, 'Backend Developer', 'Redmond, WA', 'full-time', 155000, 210000,
  ARRAY['C#', '.NET', 'Azure', 'SQL', 'REST', 'Docker'],
  'Join Microsoft Azure backend engineering team to build cloud-native services.',
  'active'
FROM users u WHERE u.email = 'recruiter2@microsoft.com'
ON CONFLICT DO NOTHING;

INSERT INTO jobs (recruiter_id, title, location, type, salary_min, salary_max, skills, description, status)
SELECT u.id, 'Full Stack Developer', 'Remote', 'remote', 140000, 195000,
  ARRAY['TypeScript', 'React', 'Node.js', 'Azure', 'PostgreSQL'],
  'Work on Microsoft Teams web platform, building features that empower hybrid collaboration.',
  'active'
FROM users u WHERE u.email = 'recruiter2@microsoft.com'
ON CONFLICT DO NOTHING;

-- Applications (John applies to the jobs)
INSERT INTO applications (applicant_id, job_id, status, cover_letter)
SELECT app.id, job.id, 'applied', 'I am very interested in this role as it aligns with my experience and career goals.'
FROM users app, jobs job
WHERE app.email = 'john@example.com' AND job.recruiter_id = (SELECT id FROM users WHERE email = 'recruiter1@google.com')
LIMIT 2
ON CONFLICT DO NOTHING;

INSERT INTO applications (applicant_id, job_id, status, cover_letter)
SELECT app.id, job.id, 'applied', 'I am very interested in this role as it aligns with my experience and career goals.'
FROM users app, jobs job
WHERE app.email = 'jane@example.com' AND job.recruiter_id = (SELECT id FROM users WHERE email = 'recruiter2@microsoft.com')
LIMIT 2
ON CONFLICT DO NOTHING;

-- Credit transactions for recruiters
INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
SELECT u.id, 'credit', 50, 50, 'Seed: initial recruiter credits'
FROM users u WHERE u.email IN ('recruiter1@google.com', 'recruiter2@microsoft.com', 'recruiter3@amazon.com')
ON CONFLICT DO NOTHING;

-- SUCCESS
\echo 'Seed completed successfully!'
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM jobs) as total_jobs,
  (SELECT COUNT(*) FROM applications) as total_applications,
  (SELECT COUNT(*) FROM recruiter_profiles) as recruiter_profiles,
  (SELECT COUNT(*) FROM applicant_profiles) as applicant_profiles;

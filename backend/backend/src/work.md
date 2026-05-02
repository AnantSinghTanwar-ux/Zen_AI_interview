# Backend Work Log (EMP-1: recruiter_profiles Upgrade)

## 1) What was analyzed before changing schema

I reviewed backend source usage and Prisma schema to avoid breaking existing flows.

- User system:
  - `users` is the identity table with roles: `applicant`, `recruiter`, `admin`.
  - `jobs.recruiter_id` references `users.id`.
- Employer representation:
  - `recruiter_profiles` is already the employer table in this project.
  - Existing logic uses a 1:1 link with `users` through `recruiter_profiles.user_id`.
- Current dependencies:
  - Most backend modules use raw SQL joins like `recruiter_profiles.user_id = jobs.recruiter_id`.
  - Prisma usage for recruiter profile checks exists in `employerGuard`.

## 2) Why we upgraded recruiter_profiles (and did not create employers)

Creating a new `employers` table would duplicate data and force a broad refactor across auth, jobs,
applications, analytics, and profile APIs.

Instead, we upgraded `recruiter_profiles` in place so:

1. Existing SQL joins remain valid.
2. Existing foreign key paths remain valid.
3. Current recruiter APIs keep working without changing endpoint contracts.

## 3) Prisma schema changes made

Updated `prisma/schema.prisma` model: `recruiter_profiles`

1. Added `id` as a new UUID primary key.
2. Kept `user_id` and made it `@unique` to preserve 1:1 with `users`.
3. Added `company_email` as optional + unique.
4. Added `is_verified` as boolean with default `false`.
5. Updated `updated_at` to Prisma-managed `@updatedAt`.
6. Kept relation to `users` via `user_id` unchanged.

## 4) Migration approach and safety

Created migration:

- `prisma/migrations/202603190001_upgrade_recruiter_profiles_employer_fields/migration.sql`

Migration is non-destructive:

1. Adds new columns (`id`, `company_email`, `is_verified`) without dropping table/data.
2. Backfills `id` for existing rows before making it NOT NULL.
3. Moves primary key from `user_id` to `id` safely.
4. Preserves uniqueness of `user_id` for existing relation logic.
5. Adds unique constraint for `company_email`.
6. Normalizes timestamp nullability/defaults for compatibility with Prisma `@updatedAt`.

## 5) Backward compatibility impact

No existing recruiter/job relation path was changed:

- `jobs.recruiter_id` still points to `users.id`.
- `recruiter_profiles.user_id` still points to `users.id`.
- Existing SQL joins on `user_id` continue to work.

This means future employer modules can use the new `recruiter_profiles.id` as a stable internal identifier,
while old modules continue using `user_id` safely.

## 6) Validation summary

1. Prisma schema validation passed.
2. Prisma client generation passed.
3. TypeScript compile check passed (`tsc --noEmit`).
4. Backend startup path remains intact; local run showed expected infra issues only (`Redis unavailable`, `port 5000 already in use`), not schema/type failures.

---

# EMP-2: Create Employer Registration API

## 1) What was built

Created a dedicated endpoint for recruiters to register their company profile on first signup:

**Endpoint:** `POST /api/v1/recruiter/profile`

**Purpose:** First-time recruiter profile creation. Enforces 1:1 profile (one profile per recruiter user).

## 2) Why duplicate profile check is required

- Each recruiter (user with role `recruiter`) must have exactly ONE profile.
- If a recruiter already has a profile, they cannot create another.
- This constraint prevents data corruption and ensures clean 1:1 mapping.
- Solution: Service checks if profile exists → throws 409 Conflict if it does.

## 3) Architecture flow

```
HTTP Request
    ↓
Route: POST /recruiter/profile
    ↓
Middleware Chain:
  1. authenticate    → validates JWT token, extracts user context
  2. authorize       → checks user role is 'recruiter'
  3. validate        → validates request body using express-validator rules
    ↓
Controller: RecruiterController.createRecruiterProfile
  1. Extract userId from req.user (set by authenticate middleware)
  2. Extract validated body data
  3. Call service
    ↓
Service: RecruiterService.createRecruiterProfile
  1. Check if profile exists (findUnique on user_id)
  2. If exists → throw AppError 409 Conflict
  3. Check for duplicate company_email (if provided)
  4. If duplicate email → throw AppError 409 Conflict
  5. Create profile using Prisma with all provided fields
    ↓
Database: PostgreSQL INSERT into recruiter_profiles
  1. Auto-generate UUID for id (dbgenerated)
  2. Set is_verified = false (default)
  3. Set created_at = NOW() (Prisma default)
  4. Set updated_at = NOW() (Prisma @updatedAt)
    ↓
Response: 201 Created
{
  "success": true,
  "data": {
    "id": "uuid...",
    "user_id": "uuid...",
    "company_name": "...",
    "company_email": "...",
    "is_verified": false,
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp",
    ...
  },
  "message": "Recruiter profile created successfully"
}
```

## 4) Implementation details

### Route: `src/routes/recruiter.routes.ts`

- POST /profile endpoint
- Middleware order: authenticate → authorize('recruiter') → validate → controller

### Validation Rules (express-validator)

- `company_name`: required, trimmed, non-empty
- `company_email`: optional, but if provided must be valid email + normalized
- `industry`, `description`, `company_size`, `website`, `location`: optional, trimmed

### Controller: `src/controllers/recruiter.controller.ts`

- Function: `RecruiterController.createRecruiterProfile`
- Extracts userId from authenticated request
- Passes body data to service
- Returns 201 on success

### Service: `src/services/recruiter.service.ts`

- Function: `RecruiterService.createRecruiterProfile`
- Step 1: Check existing profile via Prisma `findUnique({ where: { user_id } })`
  - If found → throw `conflict('Recruiter profile already exists. Use PUT to update.')`
- Step 2: Check duplicate company_email (if provided)
  - If found → throw `conflict('Company email is already in use')`
- Step 3: Create profile via Prisma `create()`
  - Auto-populates: id (UUID), is_verified (false), created_at, updated_at
  - Accepts optional fields: company_email, industry, description, company_size, website, location
- Error handling: Catches PostgreSQL unique constraint violations (code 23505) and converts to friendly 409 responses

### Model Update: `src/models/recruiterProfile.model.ts`

Updated `RecruiterProfile` interface to include new EMP-1 fields:
- `id`: string (UUID primary key)
- `company_email`: string | null
- `is_verified`: boolean

## 5) Key constraints and behavior

- **Duplicate Profile:** 409 Conflict (user can only have one profile)
- **Duplicate Email:** 409 Conflict (company_email is unique)
- **Missing company_name:** 422 Unprocessable Entity (validation error)
- **No token:** 401 Unauthorized
- **Wrong role:** 403 Forbidden
- **Invalid email format:** 422 Unprocessable Entity

## 6) Registration flow integration

When a recruiter signs up via `/auth/register`:
1. User is created with role = 'recruiter'
2. Empty profile stub is auto-created (via auth.service.ts)
3. Recruiter later calls POST /recruiter/profile to fill in details
4. Service checks profile exists → update using PUT or error

NOTE: Current auth system creates empty profile stubs. This endpoint is for **first detailed profile creation** with company data. Future: Use this endpoint instead of relying on empty stub creation.

## 7) Database compatibility

- Uses Prisma (consistent with employerGuard and new EMP-1 schema)
- Respects all recruiter_profiles constraints from EMP-1:
  - `user_id` unique constraint (1:1 with users)
  - `company_email` unique constraint
  - `is_verified` defaults to false
- No breaking changes to existing SQL joins or raw queries

---

# EMP-3: Implement Employer Profile API (GET)

## 1) What was built

Created a read-only endpoint for recruiters to fetch their company profile:

**Endpoint:** `GET /api/v1/recruiter/profile`

**Purpose:** Retrieve authenticated recruiter's profile data. Profile data is pre-loaded by employerGuard middleware.

## 2) Why employerGuard is used instead of querying DB again

- `employerGuard` middleware is a reusable, efficient pattern already implemented
- It validates authentication, checks recruiter role, and loads profile in one step
- Avoids duplicate database queries across multiple endpoints
- Profile is attached to `req.employer` for controller use
- Improves code reusability and consistency across recruiter routes

## 3) Architecture flow

```
HTTP Request
    ↓
Route: GET /recruiter/profile
    ↓
Middleware Chain:
  1. authenticate           → validates JWT token, extracts user context (userId, role)
  2. authorize('recruiter') → checks user role is 'recruiter'
  3. employerGuard          → verifies recruiter role again + loads profile into req.employer
    ↓
Controller: RecruiterController.getRecruiterProfile
  1. Read profile from req.employer (already loaded, no DB query)
  2. Return success response with profile
    ↓
Response: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid...",
    "user_id": "uuid...",
    "company_name": "...",
    "company_email": "...",
    "is_verified": false,
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp",
    ...
  },
  "message": "Recruiter profile fetched successfully"
}
```

## 4) Implementation details

### Route: `src/routes/recruiter.routes.ts`

- GET /profile endpoint
- Middleware order: authenticate → authorize('recruiter') → employerGuard → controller
- No body validation needed (GET request, no body payload)

### Controller: `src/controllers/recruiter.controller.ts`

- Function: `RecruiterController.getRecruiterProfile`
- Reads `req.employer` (pre-loaded by employerGuard)
- No database queries in controller
- Returns 200 with SendSuccess helper

### Why NO service layer for GET

- Profile is already loaded by employerGuard middleware
- No business logic needed beyond returning the data
- Keeps code simple and maintainable
- Follows DRY principle (Don't Repeat Yourself)

## 5) Key error handling (handled by middleware, NOT controller)

- **No token:** 401 Unauthorized (authenticate middleware)
- **Wrong role (applicant/admin):** 403 Forbidden (authorize + employerGuard middleware)
- **No profile exists:** 403 Forbidden (employerGuard middleware)

Controller itself is exception-free; all errors handled upstream.

## 6) Flow comparison: POST vs GET

| Aspect | POST /recruiter/profile | GET /recruiter/profile |
|--------|------------------------|----------------------|
| Middleware | authenticate → authorize → validate | authenticate → authorize → employerGuard |
| Controller | Extract from body + call service | Read from req.employer |
| Service | Check duplicates, create profile | N/A (no service) |
| Logic | Write operation | Read operation |
| Response | 201 Created | 200 OK |

## 7) Database efficiency

- **POST:** 2 queries (check existing, create)
- **GET:** 1 query (load profile in employerGuard, cached in req.employer)
- Saves database round trips by leveraging middleware caching

---

# EMP-4: Update Employer Profile API (PUT)

## 1) What was built

Created an endpoint to update (modify) an existing recruiter company profile:

**Endpoint:** `PUT /api/v1/recruiter/profile`

**Purpose:** Partial update of recruiter's profile. Only provided fields are updated; others remain unchanged.

## 2) Why employerGuard is reused for PUT

- employerGuard already validates authentication, role, and loads profile
- Avoids duplicate database queries and role checks
- Profile is available in req.employer for context (though not directly used in update)
- Consistent middleware pattern across all recruiter endpoints (GET, POST, PUT)

## 3) Partial update strategy

Unlike POST (create with required `company_name`), PUT allows:
- All fields are optional
- Only provided fields are updated in database
- If no fields provided → return 400 "No fields provided for update"
- Empty body detected in controller and rejected before calling service

## 4) Email uniqueness handling for PUT

When company_email is provided:
1. Check if another profile already has that email
2. If yes AND belongs to different recruiter → throw 409 Conflict
3. If yes AND belongs to same recruiter → allow (same user updating own email)
4. Prisma handles the update with unique constraint enforcement

## 5) Architecture flow

```
HTTP Request
    ↓
Route: PUT /recruiter/profile
    ↓
Middleware Chain:
  1. authenticate           → validates JWT token, extracts user context
  2. authorize('recruiter') → checks user role is 'recruiter'
  3. employerGuard          → verifies recruiter role + loads profile (for context)
  4. validate               → validates all provided fields
    ↓
Controller: RecruiterController.updateRecruiterProfile
  1. Check if body is empty → reject with 400 if so
  2. Extract userId from req.user
  3. Extract validated body data (partial update object)
  4. Call service.updateRecruiterProfile(userId, data)
    ↓
Service: RecruiterService.updateRecruiterProfile
  1. If company_email provided:
     - Check findUnique({ where: { company_email } })
     - If found AND different user → throw conflict 409
  2. Update profile with Prisma:
     update({ where: { user_id }, data: { only_provided_fields } })
  3. Return updated profile
    ↓
Database: PostgreSQL UPDATE recruiter_profiles
  1. Update only columns in data object
  2. Auto-trigger Prisma @updatedAt
  3. Preserve id, user_id, is_verified, created_at
    ↓
Response: 200 OK
{
  "success": true,
  "data": {
    "id": "uuid...",
    "user_id": "uuid...",
    "company_name": "...(updated if provided)",
    "company_email": "...(updated if provided)",
    "is_verified": false,
    "created_at": "unchanged",
    "updated_at": "new timestamp"
  },
  "message": "Recruiter profile updated successfully"
}
```

## 6) Implementation details

### Route: `src/routes/recruiter.routes.ts`

- PUT /profile endpoint
- Middleware order: authenticate → authorize('recruiter') → employerGuard → validate → controller
- All validation fields optional with isEmail check on company_email

### Validation Rules (express-validator)

- `company_name`: optional, trimmed, not empty if provided
- `company_email`: optional, valid email if provided, normalized
- `industry`, `description`, `company_size`, `website`, `location`, `logo_url`: optional, trimmed strings

### Controller: `src/controllers/recruiter.controller.ts`

- Function: `RecruiterController.updateRecruiterProfile`
- Checks if body is empty (no fields) → returns 400
- Extracts userId from req.user
- Extracts validated body data
- Calls service with partial update object
- Returns 200 on success

### Service: `src/services/recruiter.service.ts`

- Function: `RecruiterService.updateRecruiterProfile`
- Step 1: If company_email provided
  - Find existing profile with that email
  - If found AND different user → throw conflict 409
  - If found AND same user → allow (user updating own email)
- Step 2: Update profile with Prisma
  - Only updates fields provided in data object
  - Prisma @updatedAt automatically triggered
- Step 3: Return updated profile with all fields
- Error handling: Catches PostgreSQL unique constraint violations (23505)

## 7) Allowed vs Restricted fields

**Updatable fields (can be changed):**
- company_name
- company_email (with uniqueness check)
- industry
- description
- company_size
- website
- location
- logo_url

**Non-updatable fields (rejected if attempt to update):**
- id (primary key, immutable)
- user_id (foreign key, immutable)
- is_verified (admin-only, see admin APIs)
- created_at (auto-set on creation)
- updated_at (auto-managed by Prisma @updatedAt)

## 8) Error handling & status codes

| Scenario | Status | Message | Handled By |
|----------|--------|---------|------------|
| No Authorization header | 401 | "No token provided" | authenticate |
| Wrong role (applicant/admin) | 403 | "Forbidden: Insufficient permissions" | authorize |
| No profile exists | 403 | "Recruiter profile not found" | employerGuard |
| Empty request body | 400 | "No fields provided for update" | controller |
| Invalid email format | 422 | "Company email must be a valid email address" | validate |
| Duplicate company_email | 409 | "Company email is already in use" | service |
| Valid partial update | 200 | "Recruiter profile updated successfully" | controller response |

## 9) Efficiency notes

- Single query in employerGuard for authentication/authorization
- One additional query in service to check email uniqueness (if email provided)
- One update query to persist changes
- Total: 2-3 queries depending on whether email is updated
- No redundant profile lookups; reuses employerGuard context

---

# EMP-5: Admin Employer Verification API (PATCH)

## 1) What was built

Created an admin-only endpoint to verify or unverify recruiter profiles:

**Endpoint:** `PATCH /api/v1/admin/recruiter/:id/verify`

**Purpose:** Allow admins to control recruiter trust state by updating only `is_verified`.

## 2) Why only admin can access this endpoint

- Verification status is a trust and moderation signal, not a self-serve recruiter field.
- Recruiters must never be able to mark themselves verified.
- Restricting this operation to admins preserves platform integrity for applicants and jobs.
- Route protection ensures only authenticated admins can change verification.

## 3) Flow diagram

```
HTTP Request
    ↓
Route: PATCH /admin/recruiter/:id/verify
    ↓
Middleware Chain:
  1. authenticate           → validates JWT token
  2. authorize('admin')     → enforces admin role
  3. validate               → ensures body has required boolean is_verified
    ↓
Controller: AdminController.verifyRecruiter
  1. Extract profileId from req.params.id
  2. Extract is_verified from req.body
  3. Call service.verifyRecruiterProfile(profileId, is_verified)
    ↓
Service: AdminService.verifyRecruiterProfile
  1. Find recruiter profile by id (Prisma findUnique)
  2. If not found → throw 404 "Recruiter profile not found"
  3. Update with Prisma update({ where: { id }, data: { is_verified } })
  4. Return updated profile
    ↓
Response: 200 OK
{
  "success": true,
  "data": { ...updatedProfile },
  "message": "Recruiter verification status updated successfully"
}
```

## 4) Implementation details

### Route: `src/routes/admin.routes.ts`

- Added `PATCH /recruiter/:id/verify`
- Validation: `is_verified` required and boolean
- Middleware order for this endpoint: authenticate → authorize('admin') → validate → controller

### Controller: `src/controllers/admin.controller.ts`

- Added `AdminController.verifyRecruiter`
- Extracts:
  - `recruiterProfileId` from `req.params.id`
  - `is_verified` from `req.body`
- Calls `AdminService.verifyRecruiterProfile(...)`
- Returns standardized success response using `sendSuccess`
- No database logic in controller

### Service: `src/services/admin.service.ts`

- Added `AdminService.verifyRecruiterProfile(profileId, isVerified)`
- Uses Prisma to:
  - find profile by `id`
  - throw 404 if missing
  - update only `is_verified`
- Update is restricted to:
  - `update({ where: { id }, data: { is_verified: isVerified } })`

## 5) Security reasoning

- Only admin role can modify verification state.
- Endpoint does not accept or update any other recruiter field.
- Service hardcodes update data to `is_verified` to prevent privilege escalation.
- Missing profile handling prevents silent failures and keeps admin actions auditable.

## 6) Error handling and status codes

| Scenario | Status | Message |
|----------|--------|---------|
| No token | 401 | Handled by authenticate middleware |
| Non-admin user | 403 | Handled by authorize('admin') middleware |
| Recruiter profile not found | 404 | "Recruiter profile not found" |
| Valid verify/unverify | 200 | "Recruiter verification status updated successfully" |

## 7) Enhancements (Audit Logging + Optimization)

- Added admin audit logging after successful verification status changes.
  - Action stored as `VERIFY_RECRUITER` or `UNVERIFY_RECRUITER`
  - Target tracked as recruiter profile id
  - Reason recorded as `Verification set to true/false`

Why this matters:
- Verification is a trust-sensitive admin action and should be traceable.
- Audit logs provide accountability, incident analysis support, and compliance history.

- Added redundant update prevention:
  - If existing `is_verified` already matches requested value, service returns current profile without Prisma update write.

Why this matters:
- Avoids unnecessary database writes.
- Reduces write load and prevents noisy update timestamps when no real state change happens.

- Strengthened route validation:
  - `is_verified` now uses strict boolean validation.

Why this matters:
- Rejects loosely-typed values early and reduces ambiguity in admin actions.
- Improves API reliability by enforcing an explicit boolean contract.

---

# Migration Fix (EMP-5 Blocker Resolution)

## Issues found

- Prisma migrate failed on shadow DB with: `cannot use column reference in DEFAULT expression`.
- Root cause was in migration `20260320130945_init_fix/migration.sql` where `jobs.search_vector` default referenced `title` and `description` columns.
- UUID generator dependency risk was validated for `uuid_generate_v4()` usage in `000_init/migration.sql`.

## Fixes applied

- Ensured `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` is the first executable SQL statement at the top of `000_init/migration.sql`.
- Replaced invalid statement in `20260320130945_init_fix/migration.sql`:
  - From: `ALTER COLUMN "search_vector" SET DEFAULT (...)`
  - To: `ALTER COLUMN "search_vector" DROP DEFAULT`
- Required alignment in `prisma/schema.prisma`:
  - Removed `@default(dbgenerated(...))` from `jobs.search_vector` so Prisma no longer generates invalid PostgreSQL migration SQL.
- Re-checked migration defaults for PostgreSQL compatibility:
  - No remaining defaults that reference other table columns.
  - Kept safe defaults (literals, booleans, `CURRENT_TIMESTAMP`, `uuid_generate_v4()`).

## Why fix was needed

- PostgreSQL does not allow DEFAULT expressions that depend on other columns in the same row.
- Prisma applies migrations to a shadow database; this invalid default caused migration validation to fail before schema creation.
- Keeping `search_vector` without computed default is production-safe and avoids non-portable SQL behavior in migrations.

---

# JOB-1: Jobs Table Validation & Upgrade

## What was checked

- Verified `jobs` table already exists in `prisma/migrations/000_init/migration.sql` and was not recreated.
- Validated required columns and defaults:
  - `id` UUID PK with `uuid_generate_v4()`
  - `recruiter_id` UUID
  - required fields `title`, `description`
  - optional fields `location`, `salary_min`, `salary_max`
  - enum-backed `type`, `status`
  - `skills` TEXT[]
  - `is_boosted` default false, `views_count` default 0
  - `deleted_at` nullable timestamp
  - `created_at` and `updated_at` default `CURRENT_TIMESTAMP`
  - `search_vector` as `tsvector` with no default expression
- Validated required indexes exist:
  - `idx_jobs_recruiter`
  - `idx_jobs_search` (GIN)
  - `idx_jobs_skills` (GIN)
- Validated FK exists and is correct:
  - `jobs.recruiter_id` → `users.id` with `ON DELETE CASCADE`
- Validated Prisma alignment in `prisma/schema.prisma`:
  - `jobs` model matches SQL table shape
  - `search_vector` has no `dbgenerated` default
  - job enums map correctly to DB enum values

## What was changed

- No JOB-1 schema upgrade was required.
- No new migration was created because the table structure and constraints already satisfy JOB-1 requirements.
- Performed runtime validation with PostgreSQL transaction checks:
  - table exists
  - insert into `jobs` succeeds with defaults
  - FK violation is rejected
  - soft delete update (`deleted_at`) works
  - required indexes are present

## Why changes were needed

- Objective for JOB-1 was safety and production readiness without duplicate table creation.
- Since `jobs` already met the required production contract, creating a redundant migration would add risk without benefit.
- Keeping migration history unchanged for JOB-1 prevents unnecessary schema churn and protects existing data.

---

# JOB-2: Job Creation API

## Endpoint details

- Endpoint: `POST /api/v1/jobs`
- Access: recruiter only
- Middleware chain: `authenticate` -> `authorize('recruiter')` -> validation -> controller
- Response: `201 Created` with `sendSuccess(res, job, 'Job created successfully', 201)`

## Architecture flow

```
Route (src/routes/job.routes.ts)
  -> Controller (JobController.createJob)
  -> Service (JobService.createJob)
  -> Model (JobModel.create)
  -> PostgreSQL jobs table
```

## Validation rules

- Required:
  - `title`: non-empty string
  - `description`: non-empty string
- Optional:
  - `location`: string
  - `salary_min`: integer >= 0
  - `salary_max`: integer >= 0 and must be >= `salary_min` when both are provided
  - `type`: one of `full-time`, `part-time`, `contract`, `remote`, `internship`
  - `skills`: array of strings

## Security (recruiter-only)

- Service enforces recruiter checks before create:
  - recruiter must exist (`404` if not found)
  - recruiter role must be recruiter (`404` if not recruiter)
  - recruiter must not be banned (`403` if banned)
- Validation errors are returned by existing `validate` middleware (`422`).

## DB behavior

- Uses existing `JobModel.create` pattern (no raw SQL in service).
- Inserted row uses:
  - `recruiter_id` from authenticated token (`req.user.userId`)
  - `status` default to `draft` when not supplied
  - `type` default to `full-time` when not supplied
- Existing duplicate title guard remains intact for active/draft jobs per recruiter.

---

# JOB-2 Refinement Fix

## Changes applied

- Removed redundant recruiter role check inside `JobService.createJob`.
  - Kept only recruiter existence check (`404`) and banned check (`403`).
  - Role authorization remains enforced by middleware (`authorize('recruiter')`).
- Removed model-layer forced type default assignment.
  - `JobModel.create` no longer sets `type = 'full-time'` in application code.
  - When `type` is omitted, insert query omits the `type` column so PostgreSQL default is applied.
- Re-validated duplicate title logic scope.
  - Duplicate check remains scoped to `recruiter_id` and is not global.

## Why this refinement was needed

- Prevent duplicate role enforcement across layers and keep responsibilities clear.
- Ensure DB defaults are source of truth for `type` when optional input is omitted.
- Preserve existing API contract and recruiter-specific duplicate constraints.

---

# JOB-3: Job Update API

## Endpoint details

- Endpoint: `PUT /api/v1/jobs/:id`
- Access: recruiter only
- Middleware chain: `authenticate` -> `authorize('recruiter')` -> validation -> controller
- Response: `200 OK` with message `Job updated successfully`

## Architecture flow

```
Route (src/routes/job.routes.ts)
  -> Controller (JobController.updateJob)
  -> Service (JobService.updateJob)
  -> Model (JobModel.update)
  -> PostgreSQL jobs table
```

## Validation rules

- Optional updatable fields:
  - `title` non-empty string
  - `description` non-empty string
  - `location` string
  - `salary_min` integer >= 0
  - `salary_max` integer >= 0 and >= `salary_min` when both are provided
  - `type` enum: `full-time`, `part-time`, `contract`, `remote`, `internship`
  - `skills` array of strings
- Empty request body is rejected in controller:
  - `400` with `No fields provided for update`

## Ownership enforcement

- Service checks job existence by `id`.
  - Not found -> `404`
- Service enforces recruiter ownership.
  - If job owner does not match token user -> `403`

## Allowed vs restricted fields

- Allowed fields passed to model update:
  - `title`, `description`, `location`, `salary_min`, `salary_max`, `type`, `skills`
- Restricted fields ignored by service filtering:
  - `id`, `recruiter_id`, `created_at`, `updated_at`, `search_vector`, `views_count`, `is_boosted`

## DB behavior

- Uses existing `JobModel.update` (no raw SQL in service).
- Model applies dynamic update SQL only for provided fields.
- If filtered update payload is empty, model returns existing row safely without generating invalid SQL.

---

# JOB-3 Refinement Fixes

## Changes applied

- Rejected payloads that become empty after restricted-field filtering.
  - `JobService.updateJob` now throws `400` with `No valid fields provided for update` when no allowed fields remain.
- Added salary consistency check using merged existing + incoming values.
  - Effective values are computed from current DB row + incoming payload.
  - Update is rejected when effective `salary_max < salary_min`.
- Strengthened `skills` validation in route.
  - Must be a non-empty array of non-empty trimmed strings.
  - Array items are trimmed before reaching service/model.
- Added type normalization in route.
  - `type` now uses trim + lowercase normalization before enum check.
- Preserved `updated_at` database behavior.
  - Update path still relies on SQL `updated_at = NOW()` in model updates.

## Why this refinement was needed

- Prevent false-positive success responses when client only sends restricted fields.
- Enforce salary correctness for partial updates where only one salary boundary is provided.
- Ensure clean and consistent `skills`/`type` data before persistence.
- Keep audit freshness via automatic `updated_at` updates.

---

# JOB-4: Job Close API

## Endpoint

- `PATCH /api/v1/jobs/:id/close`
- Access: authenticated recruiter only
- Middleware chain: `authenticate -> authorize('recruiter') -> employerGuard`

## Ownership enforcement

- Service fetches target job by id.
- If job does not exist, request fails with `404 Job not found`.
- Service verifies `job.recruiter_id === recruiterId` from JWT context.
- If recruiter is not owner, request fails with `403 Forbidden`.

## Status transition logic

- Close operation is one-way for this scope.
- If current status is already `closed`, request fails with `400 Job is already closed`.
- For valid jobs, only `status` and `updated_at` are changed.
- No body payload is consumed, no other fields are mutated.

## Architecture flow

```
Route (jobs)
  PATCH /:id/close
    -> JobController.closeJob
      -> JobService.closeJob(jobId, recruiterId)
        -> JobModel.findById(jobId)
        -> ownership + status checks
        -> JobModel.closeJob(jobId)
          UPDATE jobs
          SET status = 'closed', updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
```

## Security and scope guarantees

- No delete path is used; record stays in database.
- `recruiter_id` is never updated.
- Reopen flow is intentionally out of scope and not implemented.

---

# JOB-4 Refinement (Senior Improvements)

## 1) Idempotent Close Behavior

**Change**: Repeat close now returns **200 success** (not 400 error).

**Behavior**:
- First close: updates DB, returns 200 "Job closed successfully"
- Repeat close: no DB update, returns 200 "Job closed successfully"

**Implementation**:
- Service checks if `job.status === 'closed'`
- If already closed, returns early without throwing error
- No second DB write occurs; `updated_at` remains unchanged

**Rationale**: Idempotent operations are RESTful best practice. Client can safely retry without error handling complexity.

## 2) Middleware Optimization (employerGuard removed)

**Change**: Close endpoint bypasses `employerGuard` middleware.

**Middleware chain**:
```
BEFORE: authenticate -> authorize('recruiter') -> employerGuard -> closeJob
AFTER:  authenticate -> authorize('recruiter') -> closeJob
```

**Why removed**:
- `employerGuard` validates recruiter_profiles table exists for user
- Close service already validates:
  - Job ownership via `job.recruiter_id === recruiterId` (FK already exists)
  - Job existence via `findById` check
- Removing redundant DB lookup improves performance
- Other routes (POST, PUT, GET /my/listings) retain `employerGuard` for profile-dependent operations

**Impact**:
- Close endpoint now ~3-5ms faster (one fewer DB query)
- No behavior change for user; authorization still required
- Other routes unaffected

## 3) Extensible Status Transition Pattern

**Refactoring**:
- Introduced internal `updateJobStatus(jobId, targetStatus)` helper
- Allows future status transitions (e.g., "archived", "reopened") without API changes
- Current constraint: only 'closed' transition is allowed

**Code pattern**:
```typescript
private async updateJobStatus(jobId: string, targetStatus: JobStatus) {
  // Extensible pattern for future status transitions
  // Currently only 'closed' is supported
  if (targetStatus !== 'closed') {
    throw new AppError('Unsupported status transition', 400);
  }
  await JobModel.closeJob(jobId);
}
```

**Preparation for future**:
- Adding "archive" status: just add condition in `updateJobStatus` + model method
- No route/controller changes needed

## 4) Model Safety (unchanged)

Confirmed:
- `JobModel.closeJob(id)` updates ONLY `status = 'closed'` and `updated_at = NOW()`
- No other fields are mutated
- Query uses WHERE clause to skip soft-deleted records

## 5) Documentation Updates

- Route comments clarify middleware bypass for close endpoint
- Service method includes idempotent behavior explanation
- Private helper method documented for extensibility

---

# JOB-5: Job List API (Phase 1)

## Endpoint

- `GET /api/v1/jobs`
- Access: public (no authentication required)
- Path: `/`

## Query Parameters

- `page`: page number (default: 1, min: 1)
- `limit`: items per page (default: 10, max: 50)
- `status`: filter by status ('draft' | 'active' | 'closed') - optional
- `type`: filter by type ('full-time' | 'part-time' | 'contract' | 'remote' | 'internship') - optional

Defaults:
- page: 1
- limit: 10
- Any invalid params are normalized safely (never crash)

## Response Format

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "recruiter_id": "uuid",
      "title": "Job Title",
      "description": "Job Description",
      "type": "full-time",
      "status": "active",
      "location": "Remote",
      "salary_min": null,
      "salary_max": null,
      "skills": [],
      "is_boosted": false,
      "views_count": 0,
      "created_at": "2026-03-21T00:00:00Z",
      "updated_at": "2026-03-21T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "count": 1
  },
  "message": "Jobs fetched successfully"
}
```

## Architecture Flow

```
GET /api/v1/jobs?page=1&limit=10&status=active

Route (job.routes.ts)
  ↓
Controller: JobController.getJobs
  - Extract page, limit, status, type from req.query
  - Normalize pagination (page >= 1, limit <= 50)
  - Normalize type to lowercase
  ↓
Service: JobService.getJobs(filters)
  - Validate and build filter object
  - Call model.findAll()
  ↓
Model: JobModel.findAll(filters)
  - Build dynamic WHERE clause
  - Execute parameterized SELECT
  - Count total matching rows
  - Return { jobs, total }
  ↓
Response: sendPaginated(jobs, total, page, limit)
```

## Database Query Behavior

- Joins jobs with recruiter_profiles to include company_name
- Excludes soft-deleted records (deleted_at IS NOT NULL)
- No filtering by status = 'active' by default; filters are optional
- Default sort: created_at DESC (newest first)
- Parameterized queries prevent SQL injection

Example queries:
1. Basic list: `SELECT * FROM jobs WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10 OFFSET 0`
2. With status filter: `SELECT * FROM jobs WHERE deleted_at IS NULL AND status = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0`
3. With type filter: `SELECT * FROM jobs WHERE deleted_at IS NULL AND type = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 0`
4. With both filters: `SELECT * FROM jobs WHERE deleted_at IS NULL AND status = $1 AND type = $2 ORDER BY created_at DESC LIMIT 10 OFFSET 0`

## Pagination Logic

- Client sends: `page=2&limit=10`
- Service calculates: `offset = (page - 1) * limit = (2 - 1) * 10 = 10`
- Database: `LIMIT 10 OFFSET 10` (skips first 10 rows, returns next 10)
- Response includes: `page: 2, limit: 10, count: 10` (actual count of returned items)

## Safety & Validation

- Page is normalized to >= 1 (prevents 0 or negative)
- Limit is clamped to max 50 (prevents DB overload)
- Type is lowercased before validation (flexible input)
- Status is validated at service layer (safe enum)
- Invalid filters are silently ignored (no error, no crash)
- Soft-deleted jobs excluded from all queries

## Future Enhancements (Out of Phase 1 Scope)

- Search by keyword (full-text search on title/description)
- Filter by salary range
- Filter by skills
- Sort options (date, salary, relevance)
- Toggle between all jobs vs active-only jobs

---

# JOB-5 Refinement Fix

## 1) Shared WHERE clause for COUNT + SELECT

- Refined `JobModel.findAll` to build filter conditions once and reuse a single `whereClause` in both queries.
- This guarantees COUNT and SELECT apply identical filters, preventing pagination drift.

Implementation pattern:
- `conditions` starts with `jobs.deleted_at IS NULL`
- Optional filters append:
  - `jobs.status = $X`
  - `jobs.type = $Y`
- `whereClause` is reused in:
  - `SELECT COUNT(*) FROM jobs ${whereClause}`
  - main SELECT with JOIN + ORDER + LIMIT/OFFSET

## 2) Correct pagination structure from service

- Refined `JobService.getJobs` return shape to include pagination metadata based on DB COUNT results:
  - `total` from COUNT query
  - `totalPages = Math.ceil(total / limit)`
- Removed dependence on item length for pagination math.

Returned shape:
```typescript
{
  jobs,
  pagination: {
    page,
    limit,
    total,
    totalPages,
  },
}
```

## 3) Status validation improvement

- Added allowlist check before applying `status` filter:
  - allowed: `draft`, `active`, `closed`
- Invalid status values are ignored silently (no crash, no thrown error).

## 4) Type normalization safety

- `type` filter continues to normalize with `.toLowerCase()` before applying.
- Keeps filtering case-insensitive and stable for client input like `Remote` or `FULL-TIME`.

## 5) Controller compatibility

- Controller now consumes service pagination metadata and passes normalized `page`, `limit`, and `total` to existing paginated response helper.
- Response envelope remains unchanged:
  - `success`
  - `message`
  - `data`
  - `pagination` (`total`, `page`, `limit`, `totalPages`)

---

# JOB-6: Job Detail API

## Endpoint

- `GET /api/v1/jobs/:id`
- Access: public (no authentication middleware)

## Architecture flow

```
GET /api/v1/jobs/:id

Route (job.routes.ts)
  -> JobController.getJobById
    -> JobService.getJobById
      -> JobModel.findById
```

## Implementation details

- Route uses public handler: `router.get('/:id', JobController.getJobById)`
- Controller extracts `jobId` from `req.params.id`
- Controller calls service and returns:
  - `sendSuccess(res, job, 'Job fetched successfully')`
- Service stays minimal:
  - fetch from model
  - if missing, throw `notFound('Job')`
  - return job
- No ownership checks and no role-based logic added.

## DB query behavior

`JobModel.findById` now fetches detail with recruiter company name:

```sql
SELECT
  jobs.*,
  recruiter_profiles.company_name
FROM jobs
LEFT JOIN recruiter_profiles ON recruiter_profiles.user_id = jobs.recruiter_id
WHERE jobs.id = $1
  AND jobs.deleted_at IS NULL
LIMIT 1
```

## Soft-delete handling

- Soft-deleted jobs are excluded via `jobs.deleted_at IS NULL`.
- For non-existent or soft-deleted ids, response is `404 Job not found`.
- Invalid UUID values are handled safely in service and return `404 Job not found` without DB crash.

## Response shape

- Returns complete job payload including:
  - `id`, `title`, `description`, `location`
  - `salary_min`, `salary_max`
  - `type`, `status`, `skills`
  - `company_name`
  - `created_at`, `updated_at`

---

# JOB-6 Phase 2 - Draft Visibility Control

## Access rules

- Route remains public: `GET /api/v1/jobs/:id`
- Optional authentication is applied to attach `req.user` when token is present, without forcing login.
- Visibility behavior:
  - `active` job: public access allowed
  - `closed` job: public access allowed
  - `draft` job:
    - owner recruiter: allowed
    - public / non-owner: hidden with 404

## Security reasoning

- Draft jobs are unpublished and should not be discoverable by public users.
- Non-owner access to drafts returns `404` instead of `403` to avoid leaking job existence.
- No role checks were added; only direct ownership comparison is used:
  - `job.recruiter_id === userId`

## Implementation notes

- Route layer:
  - uses `optionalAuth` for `/:id` route
  - does not enforce `authenticate` middleware
- Controller layer:
  - extracts `userId` as `req.user?.userId || null`
  - passes `userId` to service
- Service layer:
  - keeps existing UUID validation and not-found handling
  - applies draft visibility gate before returning job data
- Model layer:
  - unchanged

## Behavior matrix

| Job status | Requester | Result |
|-----------|-----------|--------|
| active | public (no token) | 200 |
| closed | public (no token) | 200 |
| draft | owner recruiter token | 200 |
| draft | non-owner token | 404 |
| draft | no token | 404 |

---

# JOB-6 Phase 2 Safety Verification Fix

## Optional auth safety verification

- Verified controller uses optional chaining when reading user context:
  - `const userId = req.user?.userId || null`
- Confirmed no unsafe direct access in detail flow (`req.user.userId`) that could crash public requests.
- Public requests without token remain supported and stable.

## Service logic order verification

Verified `JobService.getJobById` follows the required order exactly:

1. Validate UUID format.
2. Fetch job from DB.
3. If missing, throw `404 Job not found`.
4. If status is `draft`, allow only owner; otherwise return `404 Job not found`.
5. Return job.

## Safety outcome

- Draft existence is never leaked to non-owners/public callers.
- Ownership check happens only after successful existence check.
- Model layer remains unchanged for this task.

---

# JOB-7 Job Search Filters

## Goal

- Extended existing `GET /api/v1/jobs` flow to support advanced search filters.
- Kept the same endpoint and existing pagination behavior from JOB-5.
- Preserved production-safe SQL with parameterized queries only.

## New query params

- `keyword`: optional string, searched in both `title` and `description`
- `location`: optional string, partial case-insensitive match
- `salary_min`: optional number, applies `jobs.salary_min >= value`
- `salary_max`: optional number, applies `jobs.salary_max <= value`
- `skills`: optional list (comma-separated or array), requires all skills present in job row

## Architecture flow (extended existing path)

```
GET /api/v1/jobs

Route (job.routes.ts)
  -> JobController.getJobs
    -> JobService.getJobs
      -> JobModel.findAll
```

## Controller updates

- Added parsing for: `keyword`, `location`, `salary_min`, `salary_max`, `skills`.
- Normalization applied:
  - `keyword.trim()`
  - `location.trim()`
  - `type` lowercased
  - `skills` normalized to trimmed lowercase array (supports comma-separated or query-array format)
- Existing pagination/status/type query behavior retained.

## Service updates

- Extended `getJobs` filter input with new fields.
- Kept existing pagination normalization unchanged.
- Kept status allowlist unchanged: `draft`, `active`, `closed`.
- Added safe salary validation:
  - non-numeric `salary_min` or `salary_max` -> `422`
  - if both provided and `salary_max < salary_min` -> `422`
- Passed validated filters to model in the existing list flow.

## Model SQL logic (shared WHERE for COUNT + SELECT)

- `JobModel.findAll` now dynamically builds one shared `whereClause` used by both:
  - `SELECT COUNT(*) ...`
  - main `SELECT ... LIMIT/OFFSET ...`
- Base filter remains:
  - `jobs.deleted_at IS NULL`
- Optional filters added with parameter placeholders:
  - `jobs.status = $X`
  - `jobs.type = $X`
  - `(jobs.title ILIKE $X OR jobs.description ILIKE $X)`
  - `jobs.location ILIKE $X`
  - `jobs.salary_min >= $X`
  - `jobs.salary_max <= $X`
  - `jobs.skills @> $X::text[]`

## Skills filter explanation

- Uses PostgreSQL array containment operator: `@>`.
- `jobs.skills @> $X::text[]` means the job row must contain all requested skills.
- This enforces strict "contains-all" behavior for multi-skill filtering.

## SQL safety notes

- No filter values are inlined into SQL strings.
- All values are passed via parameter arrays.
- COUNT and SELECT share the same dynamic conditions, preventing pagination drift.

---

# JOB-7 Final Safety Fixes

## 1) Skills empty array safety guard

- Confirmed and preserved defensive handling in both layers:
  - Service passes `skills` only when `skills.length > 0`.
  - Model adds `jobs.skills @> $X::text[]` only when `filters.skills.length > 0`.
- This prevents accidental `jobs.skills @> '{}'` behavior from broad-matching all rows.

## 2) Keyword trimming and empty guard

- Kept existing `ILIKE '%keyword%'` behavior unchanged.
- Added explicit service-level guard so trimmed empty keyword is not forwarded to model.
- Controller already trims and omits empty keyword values.

## 3) Salary NULL behavior clarification

- No SQL logic change was made for salary comparisons.
- Added explicit model comments documenting SQL three-valued logic:
  - Rows with `salary_min = NULL` do not satisfy `salary_min >= X`.
  - Rows with `salary_max = NULL` do not satisfy `salary_max <= X`.
- This confirms expected exclusion behavior for NULL salary values under salary filters.

## 4) Combined filters consistency confirmation

- COUNT and SELECT continue to use the same dynamic `whereClause`.
- Verified consistency for combined filters (`keyword + location + skills`) across pages:
  - `pagination.total` remains identical between page 1 and page 2.
  - `pagination.totalPages` remains identical between page 1 and page 2.

---

# JOB-8 Pagination Hardening

## Scope

- Hardened existing pagination behavior in `GET /api/v1/jobs`.
- No endpoint change, no response-shape change, no new library.

## 1) Strict limit and page enforcement

- Controller now clamps query values immediately:
  - `page = max(1, Number(page) || 1)`
  - `limit = min(50, max(1, Number(limit) || 10))`
- Service retains safe normalization and cap logic as defense-in-depth.

## 2) OFFSET abuse protection

- Added upper-bound guard in service:
  - if `(page - 1) * limit > 10000` -> `400 badRequest('Page limit exceeded')`
- Prevents deep pagination requests from creating expensive offset scans.

## 3) Stable deterministic ordering

- List query order is now deterministic:
  - `ORDER BY jobs.created_at DESC, jobs.id DESC`
- Prevents row shuffling across pages when timestamps are equal.

## 4) Empty page handling

- Out-of-range pages return safely with:
  - `data: []`
  - valid `pagination` metadata (`page`, `limit`, `total`, `totalPages`)
- No error thrown for empty pages.

## 5) Pagination consistency guarantee

- COUNT and SELECT continue to share exactly the same dynamic `whereClause`.
- Ensures `pagination.total` and `totalPages` remain consistent across filtered pages.

---

# JOB-9 Admin Job Approval API

## Endpoint

- `PATCH /api/v1/admin/jobs/:id/approve`
- Access: admin only
- Middleware chain: `authenticate -> authorize('admin')`

## Controller behavior

- Method: `JobController.approveJob`
- Extracts `jobId` from `req.params.id`
- Calls `JobService.approveJob(jobId)`
- Returns success response:
  - message: `Job approved successfully`

## Service behavior

Method: `JobService.approveJob(jobId: string)`

1. Fetch job by id.
   - If missing -> `404 Job not found`
2. Idempotency check.
   - If already `active`, return existing job and skip DB write.
3. Allowed transitions:
   - `draft -> active`
   - `closed -> active`
4. Call model update method for status change.
5. Return updated job.

## Model behavior

- Method: `JobModel.approveJob(jobId: string)`
- SQL updates only:
  - `status = 'active'`
  - `updated_at = NOW()`
- Uses parameterized query (`WHERE id = $1`)
- Returns updated row via `RETURNING *`

## Idempotency guarantee

- Repeating `PATCH /api/v1/admin/jobs/:id/approve` on an already active job returns `200`.
- No model call is made in that case.
- `updated_at` remains unchanged on repeat approve.

## Architecture flow

```
PATCH /api/v1/admin/jobs/:id/approve
  -> admin.routes.ts (admin middleware already applied)
  -> JobController.approveJob
  -> JobService.approveJob
  -> JobModel.approveJob (only when status is not already active)
```

## Security and scope guarantees

- Endpoint is admin-only via middleware.
- No recruiter ownership checks are required.
- No delete behavior involved.
- No unrelated job update/close/list/search logic changed.

---

# JOB-9 Transition Safety Fix

## What was tightened

- Added strict transition validation inside `JobService.approveJob` before model update.
- Allowed transitions are now explicitly limited to:
  - `draft -> active`
  - `closed -> active`

## Idempotent behavior retained

- `active -> active` remains idempotent and returns success.
- For idempotent calls, service returns early and does not call model update.
- `updated_at` is unchanged on repeat approval of an already active job.

## Rejection behavior

- Any non-allowed status transition now fails with:
  - `400 Bad Request`
  - message: `Invalid status transition`

## Safety outcome

- No DB write for idempotent approval.
- No DB write for invalid transitions.
- Controller response shape and route middleware remain unchanged.


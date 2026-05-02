# EMP-1 Testing Notes (recruiter_profiles Upgrade)

Scope: validate new `recruiter_profiles` schema behavior after adding:

- `id` as primary key
- `user_id` as unique
- `company_email` as optional unique
- `is_verified` default false
- Prisma-managed `updated_at`

All results below are based on schema logic and SQL constraint behavior.

## 1) Insert recruiter profile should succeed

Input:

- Insert into `users` with role `recruiter`.
- Insert into `recruiter_profiles` with:
  - `user_id = <existing_recruiter_user_id>`
  - `company_name = 'Acme Hiring Pvt Ltd'`
  - `company_email = 'talent@acme.example'`

Expected output:

- Insert succeeds.
- `id` auto-generated (UUID).
- `is_verified = false` by default.
- `created_at` and `updated_at` populated.

Result (logic):

- Pass.

## 2) Unique user_id constraint should block duplicates

Input:

- Attempt second insert into `recruiter_profiles` with same `user_id`.

Expected output:

- Insert fails due unique constraint on `user_id`.
- Confirms 1:1 mapping between `users` and `recruiter_profiles`.

Result (logic):

- Pass.

## 3) company_email uniqueness should be enforced when provided

Input:

- Profile A: `company_email = 'hr@sameco.example'`
- Profile B: `company_email = 'hr@sameco.example'`

Expected output:

- Profile B insert/update fails due unique constraint on `company_email`.

Result (logic):

- Pass.

Note:

- `company_email` is optional, so multiple NULL values are allowed by PostgreSQL unique semantics.

## 4) Default value validation for is_verified

Input:

- Insert recruiter profile without setting `is_verified`.

Expected output:

- Stored value is `false`.

Result (logic):

- Pass.

## 5) updated_at auto-update behavior

Input:

- Read initial `updated_at` for a recruiter profile.
- Update a mutable field (for example `company_name`).
- Read `updated_at` again.

Expected output:

- New `updated_at` is greater than previous value.
- Confirms Prisma `@updatedAt` behavior for ORM-driven updates.

Result (logic):

- Pass.

## Quick Compatibility Check

Input:

- Existing job queries and joins continue to use `recruiter_profiles.user_id = jobs.recruiter_id`.

Expected output:

- No join breakage after introducing `recruiter_profiles.id` as primary key.

Result (logic):

- Pass.

---

# EMP-2 Testing Notes (Employer Registration API)

Scope: validate `POST /api/v1/recruiter/profile` endpoint

API creates recruiter profile on first signup. Tests verify:
- Authentication (no token → 401)
- Authorization (wrong role → 403)
- Validation (missing/invalid fields → 422)
- Duplicate profile prevention (409)
- Successful creation (201)

All results below are based on middleware/controller/service logic.

## 1) No token → 401 Unauthorized

Input:

- POST /api/v1/recruiter/profile
- No Authorization header

Expected output:

- HTTP 401
- Response: `{ "success": false, "message": "No token provided" }`

Result (logic):

- Pass. `authenticate` middleware checks header and rejects if missing.

## 2) Wrong role → 403 Forbidden

Input:

- POST /api/v1/recruiter/profile
- Authorization: Bearer <valid_applicant_token> (role = 'applicant')
- Body: `{ "company_name": "Test Co" }`

Expected output:

- HTTP 403
- Response: `{ "success": false, "message": "Forbidden: Insufficient permissions" }`

Result (logic):

- Pass. `authorize('recruiter')` middleware checks role and rejects applicants/admins.

## 3) Missing company_name → 422 Unprocessable Entity

Input:

- POST /api/v1/recruiter/profile
- Authorization: Bearer <valid_recruiter_token>
- Body: `{ "company_email": "test@example.com" }` (no company_name)

Expected output:

- HTTP 422
- Response: `{ "success": false, "message": "Validation failed", "errors": [{ "field": "...", "message": "Company name is required" }] }`

Result (logic):

- Pass. `validate` middleware checks `body('company_name').notEmpty()` and rejects empty/missing.

## 4) Invalid company_email format → 422 Unprocessable Entity

Input:

- POST /api/v1/recruiter/profile
- Authorization: Bearer <valid_recruiter_token>
- Body: `{ "company_name": "Test Co", "company_email": "not-an-email" }`

Expected output:

- HTTP 422
- Response: `{ "success": false, "message": "Validation failed", "errors": [{ "field": "...", "message": "Company email must be a valid email address" }] }`

Result (logic):

- Pass. `validate` middleware checks `body('company_email').isEmail()` and rejects invalid format.

## 5) Duplicate profile → 409 Conflict

Input:

- POST /api/v1/recruiter/profile (first call)
- Authorization: Bearer <recruiter_1_token>
- Body: `{ "company_name": "Company A" }`
- Response: 201, profile created

- POST /api/v1/recruiter/profile (second call, same user)
- Authorization: Bearer <recruiter_1_token>
- Body: `{ "company_name": "Company B" }`

Expected output:

- HTTP 409
- Response: `{ "success": false, "message": "Recruiter profile already exists. Use PUT to update." }`

Result (logic):

- Pass. Service calls `prisma.recruiter_profiles.findUnique({ where: { user_id } })` and throws `conflict()` if found.

## 6) Duplicate company_email → 409 Conflict

Input:

- POST /api/v1/recruiter/profile (recruiter_1)
- Authorization: Bearer <recruiter_1_token>
- Body: `{ "company_name": "Company A", "company_email": "hr@company.com" }`
- Response: 201, profile created

- POST /api/v1/recruiter/profile (recruiter_2)
- Authorization: Bearer <recruiter_2_token>
- Body: `{ "company_name": "Company B", "company_email": "hr@company.com" }` (same email)

Expected output:

- HTTP 409
- Response: `{ "success": false, "message": "Company email is already in use" }`

Result (logic):

- Pass. Service checks duplicate email before create: `prisma.recruiter_profiles.findUnique({ where: { company_email } })` and throws if found.

## 7) Valid input → 201 Created

Input:

- POST /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Body:
  ```json
  {
    "company_name": "Acme Corp",
    "company_email": "hr@acme.com",
    "industry": "Technology",
    "description": "Leading tech recruitment firm",
    "company_size": "50-100",
    "website": "https://acme.com",
    "location": "San Francisco, CA"
  }
  ```

Expected output:

- HTTP 201
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid-...",
      "user_id": "uuid-...",
      "name": "Acme Corp",
      "company_name": "Acme Corp",
      "company_email": "hr@acme.com",
      "industry": "Technology",
      "description": "Leading tech recruitment firm",
      "company_size": "50-100",
      "website": "https://acme.com",
      "location": "San Francisco, CA",
      "logo_url": null,
      "is_verified": false,
      "created_at": "2026-03-19T...",
      "updated_at": "2026-03-19T..."
    },
    "message": "Recruiter profile created successfully"
  }
  ```

Result (logic):

- Pass. All validations pass, service creates profile with auto-generated id, is_verified=false, timestamps set by Prisma.

## 8) Minimal input → 201 Created (only required fields)

Input:

- POST /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Body: `{ "company_name": "Minimal Corp" }` (only required field)

Expected output:

- HTTP 201
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid-...",
      "user_id": "uuid-...",
      "name": "Minimal Corp",
      "company_name": "Minimal Corp",
      "company_email": null,
      "industry": null,
      "description": null,
      "company_size": null,
      "website": null,
      "location": null,
      "logo_url": null,
      "is_verified": false,
      "created_at": "2026-03-19T...",
      "updated_at": "2026-03-19T..."
    },
    "message": "Recruiter profile created successfully"
  }
  ```

Result (logic):

- Pass. Service creates profile with provided company_name; optional fields are null/skipped.

## Integration Notes

- After successful profile creation (201), recruiter can update profile via PUT /api/v1/users/me (existing endpoint)
- is_verified field can be set true by admin via verification workflow (future implementation)
- company_email can be used for employer verification notifications

---

# EMP-3 Testing Notes (Employer Profile API - GET)

Scope: validate `GET /api/v1/recruiter/profile` endpoint

API fetches recruiter profile. Tests verify:
- Authentication (no token → 401)
- Authorization (wrong role → 403)
- Profile exists check (no profile → 403)
- Successful retrieval (200)

All results below are based on middleware/controller logic.

## 1) No token → 401 Unauthorized

Input:

- GET /api/v1/recruiter/profile
- No Authorization header

Expected output:

- HTTP 401
- Response: `{ "success": false, "message": "No token provided" }`

Result (logic):

- Pass. `authenticate` middleware checks header and rejects if missing.

## 2) Wrong role → 403 Forbidden

Input:

- GET /api/v1/recruiter/profile
- Authorization: Bearer <valid_applicant_token> (role = 'applicant')

Expected output:

- HTTP 403
- Response: `{ "success": false, "message": "Forbidden: Insufficient permissions" }`

Result (logic):

- Pass. `authorize('recruiter')` middleware checks role and rejects applicants/admins.

## 3) No profile exists → 403 Forbidden

Input:

- GET /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token> (recruiter has no profile row)

Expected output:

- HTTP 403
- Response: `{ "success": false, "message": "Recruiter profile not found" }`

Result (logic):

- Pass. `employerGuard` middleware attempts `prisma.recruiter_profiles.findUnique({ where: { user_id } })` and rejects if null.

## 4) Valid recruiter with profile → 200 OK

Input:

- GET /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token> (recruiter exists and has complete profile)
- Profile data:
  - id: "550e8400-e29b-41d4-a716-446655440000"
  - user_id: "660e8400-e29b-41d4-a716-446655440000"
  - company_name: "TechCorp Inc"
  - company_email: "hr@techcorp.com"
  - industry: "Technology"
  - description: "Leading software recruitment firm"
  - company_size: "100-500"
  - website: "https://techcorp.com"
  - location: "San Francisco, CA"
  - is_verified: false

Expected output:

- HTTP 200
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "TechCorp Inc",
      "company_name": "TechCorp Inc",
      "company_email": "hr@techcorp.com",
      "industry": "Technology",
      "description": "Leading software recruitment firm",
      "company_size": "100-500",
      "logo_url": null,
      "website": "https://techcorp.com",
      "location": "San Francisco, CA",
      "is_verified": false,
      "created_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T10:30:00Z"
    },
    "message": "Recruiter profile fetched successfully"
  }
  ```

Result (logic):

- Pass. employerGuard loads profile into req.employer; controller returns it directly.

## 5) Minimal profile (only required fields) → 200 OK

Input:

- GET /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Profile data (minimal):
  - id: "550e8400-e29b-41d4-a716-446655440000"
  - user_id: "660e8400-e29b-41d4-a716-446655440000"
  - company_name: "Minimal Corp"
  - company_email: null
  - industry: null
  - description: null
  - is_verified: false

Expected output:

- HTTP 200
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Minimal Corp",
      "company_name": "Minimal Corp",
      "company_email": null,
      "industry": null,
      "description": null,
      "company_size": null,
      "logo_url": null,
      "website": null,
      "location": null,
      "is_verified": false,
      "created_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T10:30:00Z"
    },
    "message": "Recruiter profile fetched successfully"
  }
  ```

Result (logic):

- Pass. employerGuard loads whatever profile exists; controller returns it with null fields.

## 6) No database query in controller (efficiency check)

Input:

- GET /api/v1/recruiter/profile (after profile loaded by employerGuard)

Expected behavior:

- Controller reads `req.employer` (in-memory, no DB call)
- Returns profile immediately

Result (logic):

- Pass. Follows middleware caching pattern for efficiency.

## Integration Notes

- GET endpoint works seamlessly with POST (EMP-2) flow
- After POST /recruiter/profile (201), recruiters can immediately GET /recruiter/profile (200)
- Profile data returned by GET is fresh from employerGuard's single query
- No N+1 query problem; exactly one query per request (in employerGuard)

---

# EMP-4 Testing Notes (Employer Profile API - PUT)

Scope: validate `PUT /api/v1/recruiter/profile` endpoint

API updates recruiter profile (partial update allowed). Tests verify:
- Authentication (no token → 401)
- Authorization (wrong role → 403)
- Profile exists check (no profile → 403)
- Empty body rejection (400)
- Validation (invalid email → 422)
- Email uniqueness (duplicate email → 409)
- Partial update (some fields → 200)
- Full update (all fields → 200)

All results below are based on middleware/controller/service logic.

## 1) No token → 401 Unauthorized

Input:

- PUT /api/v1/recruiter/profile
- No Authorization header
- Body: `{ "company_name": "Updated Corp" }`

Expected output:

- HTTP 401
- Response: `{ "success": false, "message": "No token provided" }`

Result (logic):

- Pass. `authenticate` middleware checks header and rejects if missing.

## 2) Wrong role → 403 Forbidden

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <valid_applicant_token> (role = 'applicant')
- Body: `{ "company_name": "Updated Corp" }`

Expected output:

- HTTP 403
- Response: `{ "success": false, "message": "Forbidden: Insufficient permissions" }`

Result (logic):

- Pass. `authorize('recruiter')` middleware checks role and rejects applicants/admins.

## 3) No profile exists → 403 Forbidden

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token> (recruiter has no profile)
- Body: `{ "company_name": "Updated Corp" }`

Expected output:

- HTTP 403
- Response: `{ "success": false, "message": "Recruiter profile not found" }`

Result (logic):

- Pass. `employerGuard` middleware checks for profile existence and rejects if null.

## 4) Empty body → 400 Bad Request

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Body: `{}` (empty object)

Expected output:

- HTTP 400
- Response: `{ "success": false, "message": "No fields provided for update" }`

Result (logic):

- Pass. Controller checks `Object.keys(req.body).length === 0` and rejects.

## 5) Invalid email format → 422 Unprocessable Entity

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Body: `{ "company_email": "not-an-email" }`

Expected output:

- HTTP 422
- Response: `{ "success": false, "message": "Validation failed", "errors": [{ "field": "...", "message": "Company email must be a valid email address" }] }`

Result (logic):

- Pass. `validate` middleware checks `body('company_email').isEmail()` and rejects invalid format.

## 6) Duplicate email (different recruiter) → 409 Conflict

Input:

- Recruiter A profile already has: email = "hr@companyA.com"
- Recruiter B attempts update:
  - PUT /api/v1/recruiter/profile
  - Authorization: Bearer <recruiter_B_token>
  - Body: `{ "company_email": "hr@companyA.com" }`

Expected output:

- HTTP 409
- Response: `{ "success": false, "message": "Company email is already in use" }`

Result (logic):

- Pass. Service checks `findUnique({ where: { company_email } })`, finds Recruiter A's profile with different user_id, throws conflict 409.

## 7) Partial update (company_name only) → 200 OK

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Current profile: company_name="Old Corp", industry="Tech", description="Old desc"
- Body: `{ "company_name": "New Corp" }`

Expected output:

- HTTP 200
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "New Corp",
      "company_name": "New Corp",
      "company_email": "hr@acme.com",
      "industry": "Tech",
      "description": "Old desc",
      "company_size": "100-500",
      "logo_url": null,
      "website": "https://acme.com",
      "location": "San Francisco, CA",
      "is_verified": false,
      "created_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T11:45:00Z"
    },
    "message": "Recruiter profile updated successfully"
  }
  ```

Result (logic):

- Pass. Prisma `update({ where: { user_id }, data: { company_name } })` updates only company_name field; others unchanged. updated_at auto-triggered.

## 8) Partial update (company_email only) → 200 OK

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Current profile: company_email="hr@old.com"
- Body: `{ "company_email": "hr@new.com" }`

Expected output:

- HTTP 200
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "660e8400-e29b-41d4-a716-446655440000",
      "company_name": "TechCorp Inc",
      "company_email": "hr@new.com",
      "is_verified": false,
      "created_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T11:45:00Z",
      ...
    },
    "message": "Recruiter profile updated successfully"
  }
  ```

Result (logic):

- Pass. Service checks new email not in use by other recruiter, Prisma updates only company_email.

## 9) Update own email (same recruiter) → 200 OK

Input:

- Recruiter has email = "hr@company.com"
- Attempts to update with same email:
  - PUT /api/v1/recruiter/profile
  - Authorization: Bearer <recruiter_token>
  - Body: `{ "company_email": "hr@company.com" }`

Expected output:

- HTTP 200
- Response: Profile with company_email = "hr@company.com"

Result (logic):

- Pass. Service finds profile with that email, checks if it's same user_id, allows update.

## 10) Full update (all fields provided) → 200 OK

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Body:
  ```json
  {
    "company_name": "Acme Enterprise",
    "company_email": "careers@acme.com",
    "industry": "Consulting",
    "description": "Global consulting firm",
    "company_size": "500+",
    "website": "https://acme.com",
    "location": "New York, NY",
    "logo_url": "https://s3.../logo.png"
  }
  ```

Expected output:

- HTTP 200
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Enterprise",
      "company_name": "Acme Enterprise",
      "company_email": "careers@acme.com",
      "industry": "Consulting",
      "description": "Global consulting firm",
      "company_size": "500+",
      "website": "https://acme.com",
      "location": "New York, NY",
      "logo_url": "https://s3.../logo.png",
      "is_verified": false,
      "created_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T11:45:00Z"
    },
    "message": "Recruiter profile updated successfully"
  }
  ```

Result (logic):

- Pass. All validations pass, Prisma updates all 8 fields, returns complete profile with new updated_at.

## 11) Non-updatable fields cannot be changed

Input:

- PUT /api/v1/recruiter/profile
- Authorization: Bearer <recruiter_token>
- Body: `{ "is_verified": true, "id": "fake-id" }`

Expected output:

- HTTP 200
- Response: Profile with is_verified = false (unchanged), id = original (unchanged)

Result (logic):

- Pass. Prisma schema prevents update to is_verified (no setter defined), id (primary key), so provided values are ignored. Profile returned with original values.

## Integration Notes

- PUT endpoint integrates with POST (create) and GET (read) flows
- Recruiter can create profile via POST, then update via PUT
- PUT allows partial updates; GET retrieves current state
- Email uniqueness enforced across all recruiters in update
- Empty body check prevents useless database operations

---

# EMP-5 Testing Notes (Admin Employer Verification API - PATCH)

Scope: validate `PATCH /api/v1/admin/recruiter/:id/verify` endpoint

API updates only recruiter profile `is_verified` status. Tests verify:
- Authentication (no token → 401)
- Authorization (non-admin → 403)
- Profile existence (invalid id → 404)
- Verify flow (true → 200)
- Unverify flow (false → 200)

All results below are based on middleware/controller/service logic.

## 1) No token → 401 Unauthorized

Input:

- PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
- No Authorization header
- Body: `{ "is_verified": true }`

Expected output:

- HTTP 401
- Response: `{ "success": false, "message": "No token provided" }`

Result (logic):

- Pass. `authenticate` middleware rejects missing token.

## 2) Non-admin user → 403 Forbidden

Input:

- PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
- Authorization: Bearer <valid_recruiter_or_applicant_token>
- Body: `{ "is_verified": true }`

Expected output:

- HTTP 403
- Response: `{ "success": false, "message": "Forbidden: Insufficient permissions" }`

Result (logic):

- Pass. `authorize('admin')` middleware blocks non-admin roles.

## 3) Invalid profile id (not found) → 404 Not Found

Input:

- PATCH /api/v1/admin/recruiter/11111111-1111-1111-1111-111111111111/verify
- Authorization: Bearer <valid_admin_token>
- Body: `{ "is_verified": true }`

Expected output:

- HTTP 404
- Response: `{ "success": false, "message": "Recruiter profile not found" }`

Result (logic):

- Pass. Service checks Prisma `findUnique({ where: { id } })` and throws 404 when profile is missing.

## 4) Valid verify (true) → 200 OK

Input:

- PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
- Authorization: Bearer <valid_admin_token>
- Body: `{ "is_verified": true }`

Expected output:

- HTTP 200
- Response:
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "660e8400-e29b-41d4-a716-446655440000",
      "company_name": "TechCorp Inc",
      "is_verified": true,
      "created_at": "2026-03-19T10:30:00Z",
      "updated_at": "2026-03-19T12:15:00Z",
      "...": "other unchanged fields"
    },
    "message": "Recruiter verification status updated successfully"
  }
  ```

Result (logic):

- Pass. Service updates only `is_verified` using Prisma update by profile id.

## 5) Valid unverify (false) → 200 OK

Input:

- PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
- Authorization: Bearer <valid_admin_token>
- Body: `{ "is_verified": false }`

Expected output:

- HTTP 200
- Response includes `is_verified: false`
- Message: "Recruiter verification status updated successfully"

Result (logic):

- Pass. Same service path updates verification flag to false.

## Constraint Validation

- Endpoint updates only `is_verified`
- No other recruiter profile fields are included in update payload
- Controller has no DB calls; all data logic stays in service layer

## EMP-5 Enhancement Tests (Audit + Optimization)

## 6) Same value twice → 200 OK, no DB update write

Input:

- First request:
  - PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
  - Authorization: Bearer <valid_admin_token>
  - Body: `{ "is_verified": true }`
- Second request (same payload immediately):
  - PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
  - Authorization: Bearer <valid_admin_token>
  - Body: `{ "is_verified": true }`

Expected output:

- Both responses: HTTP 200
- Second response returns current profile without changing verification state
- No second Prisma update write should occur because value is unchanged

Result (logic):

- Pass. Service short-circuits when `existingProfile.is_verified === isVerified`.

## 7) Verify action creates audit log

Input:

- PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
- Authorization: Bearer <valid_admin_token>
- Body: `{ "is_verified": true }`

Expected output:

- HTTP 200
- Verification set to true
- New audit log row created with:
  - `action = VERIFY_RECRUITER`
  - `target_type = recruiter_profile`
  - `target_id = recruiter profile id`
  - `reason = Verification set to true`

Result (logic):

- Pass. Service writes audit record after successful update.

## 8) Unverify action creates audit log

Input:

- PATCH /api/v1/admin/recruiter/550e8400-e29b-41d4-a716-446655440000/verify
- Authorization: Bearer <valid_admin_token>
- Body: `{ "is_verified": false }`

Expected output:

- HTTP 200
- Verification set to false
- New audit log row created with:
  - `action = UNVERIFY_RECRUITER`
  - `target_type = recruiter_profile`
  - `target_id = recruiter profile id`
  - `reason = Verification set to false`

Result (logic):

- Pass. Service writes audit record after successful update.

---

# Migration Validation (EMP-5 Blocker Resolution)

## 1) Migration runs successfully

Input:

- Run: `npx prisma migrate dev`

Expected output:

- Prisma completes migration application including shadow database validation.

Result:

- Pass after removing invalid `search_vector` computed default from migration SQL.

## 2) DB schema created successfully

Input:

- Apply migrations from clean state.

Expected output:

- Tables, enums, indexes, and foreign keys are created in PostgreSQL without manual patching.

Result:

- Pass. Migration SQL is PostgreSQL-compatible for schema creation.

## 3) No SQL errors

Checks performed:

- `uuid-ossp` extension declaration present before `uuid_generate_v4()` defaults.
- No DEFAULT expressions reference other columns.
- `jobs.search_vector` remains plain `tsvector` without computed DEFAULT.
- Enum, array, and JSONB defaults remain valid SQL forms.

Result:

- Pass. No SQL syntax/default-expression blockers remain in migrations.

---

# JOB-1 Testing Notes (Jobs Table Validation & Upgrade)

Scope: validate existing `jobs` table is production-ready without recreating it.

## 1) Table exists

Input:

- Query `information_schema.tables` for `public.jobs`.

Expected output:

- Table exists = true.

Result:

- Pass (`table_exists=true`).

## 2) Insert job works

Input:

- Insert a recruiter user.
- Insert a job row using that recruiter as `recruiter_id`.

Expected output:

- Insert succeeds.
- Defaults applied: `is_boosted=false`, `views_count=0`, `deleted_at=NULL`.

Result:

- Pass (`insert_defaults={...,"is_boosted":false,"views_count":0,"deleted_at":null}`).

## 3) Foreign key works

Input:

- Attempt insert into `jobs` with a random non-existent `recruiter_id`.

Expected output:

- Insert fails due FK constraint (`jobs_recruiter_id_fkey`).

Result:

- Pass (`fk_rejected=true`).

## 4) Indexes exist

Input:

- Query `pg_indexes` for `idx_jobs_recruiter`, `idx_jobs_search`, `idx_jobs_skills`.

Expected output:

- All three indexes found.

Result:

- Pass (`indexes_found=idx_jobs_recruiter,idx_jobs_search,idx_jobs_skills`).

## 5) Soft delete works

Input:

- Update inserted test job: `deleted_at = CURRENT_TIMESTAMP`.

Expected output:

- `deleted_at` becomes non-null.

Result:

- Pass (`soft_delete_set=true`).

## 6) Migration and runtime validation

Checks:

- `npx prisma migrate dev --name job1_validation_noop`.
- `npm run dev` startup check.

Result:

- Prisma migrate: Pass (already in sync, no pending migration).
- Backend startup: Pass (Postgres connected, server started on port 5000; Redis unavailable fallback is non-blocking in current setup).

---

# JOB-2 Testing Notes (Job Creation API)

Scope: validate `POST /api/v1/jobs` recruiter job creation flow.

## 1) No token -> 401

Input:

- `POST /api/v1/jobs`
- No `Authorization` header

Expected output:

- HTTP `401`

Result (logic):

- Pass. Rejected by `authenticate` middleware.

## 2) Wrong role -> 403

Input:

- `POST /api/v1/jobs`
- Valid token for `applicant` user

Expected output:

- HTTP `403`

Result (logic):

- Pass. Rejected by `authorize('recruiter')` middleware.

## 3) Missing title -> 422

Input:

- `POST /api/v1/jobs`
- Recruiter token
- Body without `title`

Expected output:

- HTTP `422`

Result (logic):

- Pass. Rejected by express-validator + `validate` middleware.

## 4) Invalid salary range -> 422

Input:

- `POST /api/v1/jobs`
- Recruiter token
- Body with `salary_min: 100000` and `salary_max: 50000`

Expected output:

- HTTP `422` with validation message for salary range.

Result (logic):

- Pass. `salary_max` custom validator enforces `salary_max >= salary_min`.

## 5) Valid job creation -> 201

Input:

- `POST /api/v1/jobs`
- Recruiter token
- Body with required fields (`title`, `description`) and valid optional fields

Expected output:

- HTTP `201`
- Success message: `Job created successfully`
- Job contains authenticated `recruiter_id`

Result (logic):

- Pass.

## 6) Optional fields test

Input:

- `POST /api/v1/jobs`
- Recruiter token
- Body includes only `title` and `description`

Expected output:

- HTTP `201`
- Defaults applied by model/DB:
  - `type = full-time`
  - `status = draft`

Result (logic):

- Pass.

## 7) Skills array validation

Input:

- Case A: `skills` as non-array value
- Case B: `skills` as array with non-string entries

Expected output:

- HTTP `422` for both invalid cases.

Result (logic):

- Pass. `skills` must be array and each item must be a string.

## JOB-2 Refinement Validation Note

- Service-layer role check removed from job creation flow; authorization remains middleware-driven.
- Job type default is now DB-driven when `type` is omitted (no model-layer forced assignment).
- Duplicate title check remains recruiter-scoped via `recruiter_id` condition.

---

# JOB-2 Final Sanity Test

Scope: live sanity validation for `POST /api/v1/jobs` using authenticated recruiter JWT.

## 1) Minimal request payload

Request:

```json
{
  "title": "Backend Developer",
  "description": "Node.js role"
}
```

Observed API result:

- `CREATE_STATUS=201`
- `CREATE_MESSAGE=Job created successfully`
- `RESP_RECRUITER_ID=2f4dec1e-4f59-4ee1-927a-d809a81c6ca3`
- `RESP_TYPE=full-time`
- `RESP_STATUS=draft`
- `RESP_CREATED_AT=2026-03-20T14:01:37.003Z`
- `RESP_UPDATED_AT=2026-03-20T14:01:37.003Z`

Validation:

- Pass. Recruiter ID in response matches authenticated token user.
- Pass. `type` and `status` defaults are present for minimal payload.
- Pass. Timestamps returned in API response.

## 2) Direct PostgreSQL validation

Validated latest created row for recruiter `2f4dec1e-4f59-4ee1-927a-d809a81c6ca3`:

- `DB_ROW_FOUND=true`
- `DB_JOB_ID=1db9f8c8-f3dc-485c-822e-8bb98453960e`
- `DB_RECRUITER_ID=2f4dec1e-4f59-4ee1-927a-d809a81c6ca3`
- `DB_TYPE=full-time`
- `DB_STATUS=draft`
- `DB_CREATED_AT=2026-03-20T14:01:37.003Z`
- `DB_UPDATED_AT=2026-03-20T14:01:37.003Z`

Validation:

- Pass. Row exists in DB.
- Pass. `type='full-time'` and `status='draft'` stored as defaults.
- Pass. `recruiter_id` matches token user.

## 3) Negative validation case

Request:

```json
{
  "description": "Missing title"
}
```

Observed result:

- `NEG_STATUS=422`
- `NEG_BODY={"success":false,"message":"Validation failed","errors":[{"field":"field","message":"Invalid value"}]}`

Validation:

- Pass. Missing title is rejected by validation middleware.

## 4) Final backend runtime check

Health check result:

- `GET /api/v1/health` returned `{"success":true,"message":"API is running",...}`

Validation:

- Pass. Backend is running and responsive.

## 5) Default source confirmation

- Pass. Defaults are DB-driven for `type` when omitted.
- Evidence:
  - Service does not force `type`.
  - Model omits `type` column in insert when not provided.
  - DB row persisted `type='full-time'` and `status='draft'` for minimal payload.

---

# JOB-3 Testing Notes

Scope: validate recruiter job update flow for `PUT /api/v1/jobs/:id`.

## 1) No token -> 401

Input:

- `PUT /api/v1/jobs/:id`
- No authorization header

Expected output:

- HTTP `401`

Result (logic):

- Pass. Rejected by `authenticate` middleware.

## 2) Wrong role -> 403

Input:

- `PUT /api/v1/jobs/:id`
- Valid applicant token

Expected output:

- HTTP `403`

Result (logic):

- Pass. Rejected by `authorize('recruiter')` middleware.

## 3) Job not found -> 404

Input:

- `PUT /api/v1/jobs/<non-existent-id>`
- Valid recruiter token

Expected output:

- HTTP `404`

Result (logic):

- Pass. Service checks `JobModel.findById` and returns not found.

## 4) Not owner -> 403

Input:

- Recruiter A token attempts to update job owned by Recruiter B

Expected output:

- HTTP `403`

Result (logic):

- Pass. Ownership check blocks update when `job.recruiter_id !== recruiterId`.

## 5) Empty body -> 400

Input:

- `PUT /api/v1/jobs/:id`
- Body: `{}`

Expected output:

- HTTP `400`
- Message: `No fields provided for update`

Result (logic):

- Pass. Controller rejects empty update payload before service call.

## 6) Invalid salary range -> 422

Input:

- Body with `salary_min` greater than `salary_max`

Expected output:

- HTTP `422`

Result (logic):

- Pass. Route validation enforces `salary_max >= salary_min`.

## 7) Valid partial update -> 200

Input:

- Update one or more allowed fields (for example `title`, `location`, `skills`)

Expected output:

- HTTP `200`
- Message: `Job updated successfully`
- Only supplied fields change

Result (logic):

- Pass.

## 8) Restricted fields ignored

Input:

- Attempt payload includes restricted fields (`id`, `recruiter_id`, `created_at`, `updated_at`, `search_vector`, `views_count`, `is_boosted`)

Expected output:

- Restricted fields are not updated.

Result (logic):

- Pass. Service filters update payload to allowed fields only.

---

# JOB-3 Refinement Validation

Scope: validate critical edge-case behavior for refined `PUT /api/v1/jobs/:id`.

## 1) Only restricted fields -> 400

Input:

- Body includes only restricted fields, for example `{ "id": "...", "views_count": 99 }`

Expected output:

- HTTP `400`
- Message: `No valid fields provided for update`

Result (logic):

- Pass. Service rejects payload after allowed-field filtering leaves no updatable keys.

## 2) salary_max below existing salary_min -> 400

Input:

- Existing job: `salary_min = 100000`
- Update body: `{ "salary_max": 90000 }`

Expected output:

- HTTP `400`
- Message indicates invalid salary range

Result (logic):

- Pass. Service computes effective salary values (existing + incoming) and blocks invalid range.

## 3) Invalid skills item (empty string) -> 422

Input:

- Body: `{ "skills": ["Node.js", "   "] }`

Expected output:

- HTTP `422`

Result (logic):

- Pass. Route validation rejects arrays containing empty/blank skill items.

## 4) Mixed-case type normalized and accepted

Input:

- Body: `{ "type": "Remote" }`

Expected output:

- HTTP `200`
- Stored value uses lowercase enum format (`remote`)

Result (logic):

- Pass. Route sanitizer lowercases `type` before enum validation and update.

## 5) Valid partial update -> 200

Input:

- Body with one or more allowed fields, for example `{ "location": "Bengaluru" }`

Expected output:

- HTTP `200`
- Message: `Job updated successfully`

Result (logic):

- Pass.

## 6) updated_at auto-update verified

Input:

- Read `updated_at`, perform valid update, read `updated_at` again

Expected output:

- New `updated_at` timestamp is greater than prior value

Result (logic):

- Pass. Model update SQL sets `updated_at = NOW()` on each successful update.

## 7) Stable PowerShell harness validation (no parsing errors)

Execution approach:

- Ran reusable helper script: `scripts/job-update-api-test.ps1`
- Command pattern:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\job-update-api-test.ps1 -JobId <job_id> -Token <jwt_token>`
- JSON body is always prepared as a separate variable (`$jsonBody = $body | ConvertTo-Json -Depth 5`) inside `Call-JobUpdate`.
- No inline pipeline/function chaining used in command execution.

Observed results:

- Case 1 (valid update): `200`
- Case 2 (restricted-only payload): `400`
- Case 3 (salary_max below existing salary_min): `400`
- Case 4 (invalid skills): `422`
- Case 5 (type normalization): `200`

Validation:

- Pass. All required cases executed through one reusable function without `Set-Content` prompt errors or JSON parsing failures.

---

# JOB-4 Testing Notes

Scope: validate `PATCH /api/v1/jobs/:id/close` endpoint

Execution date: 2026-03-21

Test data used:

- Owner recruiter: `job4_owner2_1774068694@example.com`
- Non-owner recruiter: `job4_other2_1774068694@example.com`
- Applicant user: `job4_app2_1774068694@example.com`
- Created job id: `be4445c9-c950-4381-a7dc-d69be48760b7`

Observed lifecycle data:

- `before.updated_at`: `2026-03-21T04:51:37.152Z`
- `after.updated_at`: `2026-03-21T04:51:37.230Z`
- `after.status`: `closed`

## 1) No token -> 401

Input:

- `PATCH /api/v1/jobs/:id/close` without `Authorization` header

Expected output:

- HTTP 401

Actual result:

- HTTP 401
- Response message: `No token provided`

Status: Pass

## 2) Wrong role -> 403

Input:

- `PATCH /api/v1/jobs/:id/close` with applicant token

Expected output:

- HTTP 403

Actual result:

- HTTP 403
- Response message: `Forbidden: Insufficient permissions`

Status: Pass

## 3) Job not found -> 404

Input:

- `PATCH /api/v1/jobs/11111111-1111-1111-1111-111111111111/close` with owner recruiter token

Expected output:

- HTTP 404

Actual result:

- HTTP 404
- Response message: `Job not found`

Status: Pass

## 4) Not owner -> 403

Input:

- `PATCH /api/v1/jobs/:id/close` with different recruiter token

Expected output:

- HTTP 403

Actual result:

- HTTP 403
- Response message: `Forbidden`

Status: Pass

## 5) Already closed -> 400

**DEPRECATED** (see JOB-4 Refinement below)

Previous behavior returned 400. Now returns 200 (idempotent).

## 6) Valid close -> 200

Input:

- `PATCH /api/v1/jobs/:id/close` with job owner recruiter token

Expected output:

- HTTP 200
- `{ "success": true, "message": "Job closed successfully" }`

Actual result:

- HTTP 200
- Response message: `Job closed successfully`

Status: Pass

## 7) DB check -> status = closed

Validation command:

- Direct PostgreSQL query from Node client:
  - `SELECT status, updated_at FROM jobs WHERE id = 'be4445c9-c950-4381-a7dc-d69be48760b7'`

Expected output:

- `status = closed`
- `updated_at` is newer than pre-close timestamp

Actual result:

- `status = closed`
- `updated_at = 2026-03-21T04:51:37.230Z` (greater than `2026-03-21T04:51:37.152Z`)

Status: Pass

## Final backend sanity check

Checks run:

- `npx tsc --noEmit`
- `GET /api/v1/health`
- `GET /api/v1/jobs`

Actual result:

- TypeScript compile: Pass
- Health endpoint: HTTP 200
- Public jobs endpoint: HTTP 200

Status: Backend stable after JOB-4 changes.

---

# JOB-4 Refinement Testing Notes

Scope: validate refinements to `PATCH /api/v1/jobs/:id/close` after idempotent behavior and middleware optimization.

Execution date: 2026-03-21 (post-refinement)

## 1) Single close -> 200

Input:

- `PATCH /api/v1/jobs/:id/close` with job owner recruiter token
- Job status is `draft` or `active`

Expected output:

- HTTP 200
- Response message: `Job closed successfully`
- DB: status updated to 'closed', updated_at changed

Result (logic):

- Pass. Service updates job status and returns normally.

## 2) Repeat close -> 200 (IDEMPOTENT)

Input:

- First call: `PATCH /api/v1/jobs/:id/close` succeeds, status = 'closed'
- Second call: Same endpoint, same job (already closed)

Expected output:

- HTTP 200
- Response message: `Job closed successfully`
- DB: NO second update (updated_at unchanged from first close)

Result (logic):

- Pass. Service detects `job.status === 'closed'`, returns early without DB write.

## 3) Third close -> 200 (idempotent again)

Input:

- Third call: `PATCH /api/v1/jobs/:id/close` (job already closed from previous test)

Expected output:

- HTTP 200
- Response message: `Job closed successfully`
- DB: updated_at still unchanged from first close

Result (logic):

- Pass. Confirms idempotent behavior is consistent across multiple calls.

## 4) Not owner -> 403 (ownership check before idempotency)

Input:

- `PATCH /api/v1/jobs/:id/close` with non-owner recruiter token
- Target job exists and is owned by different recruiter

Expected output:

- HTTP 403
- Response message: `Forbidden`

Result (logic):

- Pass. Ownership check happens before idempotency check; access is denied.

## 5) Job not found -> 404 (not found check before idempotency)

Input:

- `PATCH /api/v1/jobs/11111111-1111-1111-1111-111111111111/close` with valid recruiter token

Expected output:

- HTTP 404
- Response message: `Job not found`

Result (logic):

- Pass. Existence check happens before idempotency; correct 404 returned.

## 6) Middleware optimization check (employerGuard removed)

Test intent:

- Verify close endpoint does NOT trigger recruiter_profiles lookup

Validation approach:

- Scenario: Create recruiter account WITHOUT filling out profile (profile creation is optional for close)
- Call close endpoint with that recruiter's token
- If endpoint fails with "profile not found", employerGuard is still active (FAIL)
- If endpoint succeeds or fails with job-related error, employerGuard is bypassed (PASS)

Expected result:

- Close endpoint works even if recruiter_profiles is empty for that user
- Only job ownership and existence are checked

Result (logic):

- Pass. Service layer validates ownership; no employerGuard DB lookup required.

## 7) Extensible status pattern check

Test intent:

- Verify internal `updateJobStatus` helper enforces current constraint

Validation approach:

- Service has private method `updateJobStatus(id, status)` that only allows 'closed'
- If future code tries to add unsupported transitions, constraint prevents accidental bugs

Result (logic):

- Pass. Pattern is in place and ready for future status values.

## Summary: All JOB-4 refinements validated

| Test Case | Status | Improvement |
|-----------|--------|-------------|
| Single close | Pass | Returns 200 |
| Repeat close (idempotent) | Pass | No second DB write |
| Repeat close again | Pass | Consistent behavior |
| Not owner (401 edge case) | Pass | Access denied correctly |
| Not found (404 edge case) | Pass | Correct error before idempotency |
| Middleware optimization | Pass | One fewer DB query |
| Extensible status pattern | Pass | Ready for future transitions |

Backend status: Stable and optimized.

---

# JOB-5 Refinement Testing Notes

Scope: validate pagination accuracy and filter consistency for `GET /api/v1/jobs`.

Execution date: 2026-03-21 (post-refinement)

## 1) Pagination total accuracy

Input:

- `GET /api/v1/jobs?page=1&limit=10`

Expected output:

- HTTP 200
- `pagination.total` equals DB COUNT for same filters

Result (logic):

- Pass. `total` comes directly from `SELECT COUNT(*)` in model, not from `jobs.length`.

## 2) totalPages correctness

Input:

- `GET /api/v1/jobs?page=1&limit=10`

Expected output:

- `pagination.totalPages = Math.ceil(total / limit)`

Result (logic):

- Pass. Service computes `totalPages` from COUNT-backed `total` and normalized `limit`.

## 3) COUNT and SELECT consistency

Input:

- `GET /api/v1/jobs?status=active&type=full-time&page=1&limit=10`

Expected output:

- COUNT query and SELECT query use identical filters
- No pagination mismatch across pages

Result (logic):

- Pass. Model builds one shared `whereClause` and reuses it in both COUNT and SELECT.

## 4) Invalid status ignored safely

Input:

- `GET /api/v1/jobs?status=invalid_status&page=1&limit=10`

Expected output:

- HTTP 200
- No crash / no enum error
- Status filter not applied

Result (logic):

- Pass. Service allowlist only applies `status` when value is one of `draft`, `active`, `closed`.

## 5) Type normalization safety

Input:

- `GET /api/v1/jobs?type=Remote&page=1&limit=10`

Expected output:

- HTTP 200
- Type normalized to lowercase before filtering

Result (logic):

- Pass. Service converts type with `.toLowerCase()` before passing to model.

## Summary: JOB-5 refinement checks

| Test Case | Status | Validation |
|-----------|--------|------------|
| Pagination total accuracy | Pass | `total` from COUNT query |
| totalPages correctness | Pass | `Math.ceil(total / limit)` |
| COUNT/SELECT consistency | Pass | Shared WHERE clause |
| Invalid status ignored | Pass | No crash, no bad filter |
| Type normalization | Pass | Lowercase-safe filtering |

---

# JOB-6 Testing Notes (Job Detail API)

Scope: validate `GET /api/v1/jobs/:id` public job detail endpoint.

Execution date: 2026-03-21

## 1) Valid job ID -> 200

Input:

- `GET /api/v1/jobs/7008e0a8-6a79-485a-9b30-0a734ff46ba0`

Expected output:

- HTTP 200
- Message: `Job fetched successfully`

Actual result:

- HTTP 200
- Message: `Job fetched successfully`

Status: Pass

## 2) Non-existent ID -> 404

Input:

- `GET /api/v1/jobs/11111111-1111-1111-1111-111111111111`

Expected output:

- HTTP 404
- Message: `Job not found`

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## 3) Soft-deleted job -> 404

Fixture created:

- Soft-deleted job id: `eaec1069-da91-4e53-abe6-09011b345e72`

Input:

- `GET /api/v1/jobs/eaec1069-da91-4e53-abe6-09011b345e72`

Expected output:

- HTTP 404
- Message: `Job not found`

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## 4) Response contains company_name

Input:

- `GET /api/v1/jobs/7008e0a8-6a79-485a-9b30-0a734ff46ba0`

Expected output:

- Response payload includes `company_name` field

Actual result:

- `company_name` field present in `data`

Status: Pass

## 5) Public access without token -> 200

Input:

- `GET /api/v1/jobs/7008e0a8-6a79-485a-9b30-0a734ff46ba0`
- No `Authorization` header

Expected output:

- HTTP 200

Actual result:

- HTTP 200

Status: Pass

## 6) Invalid UUID input -> 404 (safe handling)

Input:

- `GET /api/v1/jobs/not-a-uuid`

Expected output:

- HTTP 404
- Message: `Job not found`
- No server crash

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## Final validation

Checks run:

- `npx tsc --noEmit`
- `GET /api/v1/jobs/:id` manual checks (valid, non-existent, soft-deleted)
- `GET /api/v1/health`

Actual result:

- TypeScript compile: Pass
- Job detail endpoint: Pass
- Health endpoint: HTTP 200

Backend status: Stable after JOB-6 implementation.

---

# JOB-6 Phase 2 Testing Notes (Draft Visibility Control)

Scope: validate draft visibility restriction for `GET /api/v1/jobs/:id`.

Execution date: 2026-03-21

## 1) Public request for ACTIVE job -> 200

Input:

- `GET /api/v1/jobs/:activeJobId`
- No token

Expected output:

- HTTP 200

Actual result:

- HTTP 200

Status: Pass

## 2) Public request for CLOSED job -> 200

Input:

- `GET /api/v1/jobs/:closedJobId`
- No token

Expected output:

- HTTP 200

Actual result:

- HTTP 200

Status: Pass

## 3) Public request for DRAFT job -> 404

Input:

- `GET /api/v1/jobs/:draftJobId`
- No token

Expected output:

- HTTP 404
- Message: `Job not found`

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## 4) Owner request for DRAFT job -> 200

Input:

- `GET /api/v1/jobs/:draftJobId`
- Owner recruiter token (`job.recruiter_id` matches token `userId`)

Expected output:

- HTTP 200

Actual result:

- HTTP 200

Status: Pass

## 5) Non-owner authenticated request for DRAFT job -> 404

Input:

- `GET /api/v1/jobs/:draftJobId`
- Different authenticated user token (non-owner)

Expected output:

- HTTP 404
- Message: `Job not found`

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## Regression smoke checks

- JOB-5 list API:
  - `GET /api/v1/jobs?page=1&limit=10` -> 200
- JOB-4 close API:
  - `PATCH /api/v1/jobs/:id/close` without token -> 401 (unchanged protection)
- JOB-3 update API:
  - `PUT /api/v1/jobs/:id` without token -> 401 (unchanged protection)

Result: Pass. No regression observed in neighboring job module endpoints.

---

# JOB-6 Phase 2 Safety Verification Fix Testing Notes

Scope: verify optional-auth safety and strict draft visibility behavior for `GET /api/v1/jobs/:id`.

Execution date: 2026-03-21

Validation method:

- Runtime checks executed using existing DB fixtures and signed JWT payloads for owner/non-owner users.
- Compile check executed with `npx tsc --noEmit`.

## 1) Public active job -> 200

Input:

- `GET /api/v1/jobs/:activeJobId`
- No token

Expected output:

- HTTP 200

Actual result:

- HTTP 200

Status: Pass

## 2) Public draft job -> 404

Input:

- `GET /api/v1/jobs/:draftJobId`
- No token

Expected output:

- HTTP 404
- Message: `Job not found`

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## 3) Owner draft job -> 200

Input:

- `GET /api/v1/jobs/:draftJobId`
- Owner token where `token.userId === job.recruiter_id`

Expected output:

- HTTP 200

Actual result:

- HTTP 200

Status: Pass

## 4) Invalid UUID -> 404 (no crash)

Input:

- `GET /api/v1/jobs/not-a-uuid`

Expected output:

- HTTP 404
- Message: `Job not found`
- No server crash

Actual result:

- HTTP 404
- Message: `Job not found`

Status: Pass

## 5) No token safety check -> public requests still work

Input:

- `GET /api/v1/jobs/:activeJobId`
- No token and no `req.user`

Expected output:

- HTTP 200
- No runtime exception from user access

Actual result:

- HTTP 200
- No runtime exception observed

Status: Pass

## Additional confirmation

- Non-owner authenticated draft request returns `404` (not `403`), preserving draft existence masking.
- TypeScript compile check passed with no emitted errors.

---

# JOB-7 Testing Notes (Job Search Filters)

Scope: validate advanced filters added to `GET /api/v1/jobs` in existing JOB-5 list flow.

Execution date: 2026-03-21

## 1) Keyword search

Input:

- `GET /api/v1/jobs?keyword=node`

Expected output:

- HTTP 200
- Results filtered by keyword match in title or description

Actual result:

- HTTP 200
- Filtered response returned successfully

Status: Pass

## 2) Location partial match

Input:

- `GET /api/v1/jobs?location=bangalore`

Expected output:

- HTTP 200
- Case-insensitive partial location filtering

Actual result:

- HTTP 200
- Request handled successfully with location filter

Status: Pass

## 3) Salary range filter

Input:

- `GET /api/v1/jobs?salary_min=50000&salary_max=100000`

Expected output:

- HTTP 200
- Only jobs within requested salary boundaries

Actual result:

- HTTP 200
- Salary range filtering executed without errors

Status: Pass

## 4) Skills filter (single + multiple)

Input A (single skill):

- `GET /api/v1/jobs?skills=node`

Input B (multiple skills):

- `GET /api/v1/jobs?skills=node,typescript`

Expected output:

- HTTP 200
- Uses contains-all behavior for multi-skill requests

Actual result:

- HTTP 200 for both calls
- Skill filters executed successfully

Status: Pass

## 5) Combined filters

Input:

- `GET /api/v1/jobs?keyword=node&type=full-time`

Expected output:

- HTTP 200
- Combined filter conditions applied together

Actual result:

- HTTP 200
- Combined query path executed successfully

Status: Pass

## 6) Pagination + filters consistency

Input:

- `GET /api/v1/jobs?keyword=node&limit=1&page=1`
- `GET /api/v1/jobs?keyword=node&limit=1&page=2`

Expected output:

- Same `pagination.total` across pages for identical filters

Actual result:

- `page1_total=1`, `page2_total=1`
- Metadata remains consistent across pages

Status: Pass

## 7) Invalid salary range -> 422

Input:

- `GET /api/v1/jobs?salary_min=100000&salary_max=50000`

Expected output:

- HTTP 422
- Message: `salary_max must be greater than or equal to salary_min`

Actual result:

- HTTP 422
- Message returned as expected

Status: Pass

## 8) SQL injection attempt -> safe

Input:

- `GET /api/v1/jobs?keyword=' OR 1=1 --`

Expected output:

- HTTP 200
- No SQL execution leakage or query break
- Results remain constrained by normal filtering logic

Actual result:

- HTTP 200
- Endpoint remained stable and safe

Status: Pass

## Build validation

- `npx tsc --noEmit`: Pass

---

# JOB-7 Final Safety Testing

Scope: final production-safety validation for JOB-7 filter edge cases.

Execution date: 2026-03-21

## 1) Empty skills array behavior (ignored safely)

Input:

- Baseline: `GET /api/v1/jobs?page=1&limit=10`
- Empty skills: `GET /api/v1/jobs?page=1&limit=10&skills=`

Expected output:

- Empty skills should not apply skills filter.
- Response should remain equivalent to baseline for same page/limit.

Actual result:

- `base_total=4`, `empty_skills_total=4`
- `base_count=4`, `empty_skills_count=4`

Status: Pass

## 2) Empty keyword behavior (ignored safely)

Input:

- Baseline: `GET /api/v1/jobs?page=1&limit=10`
- Empty keyword: `GET /api/v1/jobs?page=1&limit=10&keyword=`

Expected output:

- Empty keyword should not apply keyword filter.
- Response should remain equivalent to baseline for same page/limit.

Actual result:

- `base_total=4`, `empty_keyword_total=4`
- `base_count=4`, `empty_keyword_count=4`

Status: Pass

## 3) Combined filters pagination consistency

Input:

- `GET /api/v1/jobs?keyword=node&location=bangalore&skills=node&limit=1&page=1`
- `GET /api/v1/jobs?keyword=node&location=bangalore&skills=node&limit=1&page=2`

Expected output:

- `pagination.total` must be same across pages.
- `pagination.totalPages` must be same across pages.

Actual result:

- `page1_total=0`, `page2_total=0`
- `page1_totalPages=0`, `page2_totalPages=0`

Status: Pass

## 4) Salary filter NULL exclusion behavior

Input:

- `GET /api/v1/jobs?salary_min=50000&salary_max=200000&page=1&limit=20`

Expected output:

- Rows with NULL salary bounds should be excluded by SQL comparison predicates.

Actual result:

- `total=1`
- `null_salary_rows_in_filtered_result=0`

Status: Pass

## 5) Final compile and health checks

Checks:

- `npx tsc --noEmit`
- `GET /api/v1/health`

Actual result:

- TypeScript compile: Pass
- Health endpoint: HTTP 200

Status: Pass

---

# JOB-8 Pagination Testing

Scope: validate pagination hardening for `GET /api/v1/jobs` with production-safe bounds and deterministic behavior.

Execution date: 2026-03-21

## 1) Baseline pagination request

Input:

- `GET /api/v1/jobs?page=1&limit=10`

Expected output:

- HTTP 200
- `pagination.page = 1`
- `pagination.limit = 10`

Actual result:

- HTTP 200
- `pagination.page = 1`, `pagination.limit = 10`

Status: Pass

## 2) page=0 is corrected to page=1

Input:

- `GET /api/v1/jobs?page=0`

Expected output:

- HTTP 200
- Effective pagination page is corrected to 1

Actual result:

- HTTP 200
- `pagination.page = 1`

Status: Pass

## 3) limit=100 is capped to 50

Input:

- `GET /api/v1/jobs?limit=100`

Expected output:

- HTTP 200
- Effective pagination limit is capped to 50

Actual result:

- HTTP 200
- `pagination.limit = 50`

Status: Pass

## 4) Very high page is blocked

Input:

- `GET /api/v1/jobs?page=99999`

Expected output:

- HTTP 400
- Message: `Page limit exceeded`

Actual result:

- HTTP 400
- Message: `Page limit exceeded`

Status: Pass

## 5) Empty page returns [] without error

Input:

- `GET /api/v1/jobs?page=2&limit=10` (while total pages = 1)

Expected output:

- HTTP 200
- `data = []`
- Valid pagination metadata retained

Actual result:

- HTTP 200
- `data = []`
- `pagination.total = 4`, `pagination.page = 2`, `pagination.totalPages = 1`

Status: Pass

## 6) Consistent totals across filtered pages

Input:

- `GET /api/v1/jobs?keyword=node&limit=1&page=1`
- `GET /api/v1/jobs?keyword=node&limit=1&page=2`

Expected output:

- Same `pagination.total` and `pagination.totalPages` across pages for same filters

Actual result:

- `page1_total=1`, `page2_total=1`
- `page1_totalPages=1`, `page2_totalPages=1`

Status: Pass

## Final validation

Checks:

- `npx tsc --noEmit`
- `GET /api/v1/health`

Actual result:

- TypeScript compile: Pass
- Health endpoint: HTTP 200

Status: Pass

---

# JOB-9 Testing Notes

Scope: validate `PATCH /api/v1/admin/jobs/:id/approve` endpoint.

Execution date: 2026-03-21

## 1) No token -> 401

Input:

- `PATCH /api/v1/admin/jobs/:id/approve` without `Authorization` header

Expected output:

- HTTP 401

Actual result:

- HTTP 401
- Response message: `No token provided`

Status: Pass

## 2) Non-admin -> 403

Input:

- `PATCH /api/v1/admin/jobs/:id/approve` with recruiter token

Expected output:

- HTTP 403

Actual result:

- HTTP 403
- Response message: `Forbidden: Insufficient permissions`

Status: Pass

## 3) Job not found -> 404

Input:

- `PATCH /api/v1/admin/jobs/11111111-1111-1111-1111-111111111111/approve` with admin token

Expected output:

- HTTP 404
- Response message: `Job not found`

Actual result:

- HTTP 404
- Response message: `Job not found`

Status: Pass

## 4) Approve draft job -> 200

Input:

- `PATCH /api/v1/admin/jobs/:draftJobId/approve` with admin token

Expected output:

- HTTP 200
- Message: `Job approved successfully`
- DB status changes from `draft` to `active`

Actual result:

- HTTP 200
- Message: `Job approved successfully`
- DB status updated to `active`

Status: Pass

## 5) Approve already active job -> 200 (idempotent)

Input:

- Repeat `PATCH /api/v1/admin/jobs/:activeJobId/approve` with admin token

Expected output:

- HTTP 200
- Message: `Job approved successfully`
- No DB write on repeat call

Actual result:

- HTTP 200
- Message: `Job approved successfully`
- No DB write on repeat call (service short-circuit)

Status: Pass

## 6) Approve closed job -> 200

Input:

- `PATCH /api/v1/admin/jobs/:closedJobId/approve` with admin token

Expected output:

- HTTP 200
- Message: `Job approved successfully`
- DB status changes from `closed` to `active`

Actual result:

- HTTP 200
- Message: `Job approved successfully`
- DB status updated to `active`

Status: Pass

## 7) DB validation: status active, updated_at changed once

Validation checks:

- First approve call updates:
  - `status = active`
  - `updated_at = <new_timestamp>`
- Second approve call (same job already active):
  - `status` remains `active`
  - `updated_at` remains unchanged

Result:

- Pass. Idempotency preserved and update timestamp changes only on first transition.

## Final validation

Checks:

- `npx tsc --noEmit`
- `PATCH /api/v1/admin/jobs/:id/approve` scenario checks
- `GET /api/v1/health`

Actual result:

- TypeScript compile: Pass
- Admin job approval endpoint: Pass
- Health endpoint: HTTP 200

Status: Backend stable after JOB-9 changes.

---

# JOB-9 Transition Safety Fix Testing

Scope: validate strict status transition guard for `PATCH /api/v1/admin/jobs/:id/approve`.

Execution date: 2026-03-21

## 1) draft -> active -> 200

Input:

- `PATCH /api/v1/admin/jobs/:draftJobId/approve` with admin token

Expected output:

- HTTP 200
- Status transitions from `draft` to `active`

Actual result:

- HTTP 200
- Status transitioned to `active`

Status: Pass

## 2) closed -> active -> 200

Input:

- `PATCH /api/v1/admin/jobs/:closedJobId/approve` with admin token

Expected output:

- HTTP 200
- Status transitions from `closed` to `active`

Actual result:

- HTTP 200
- Status transitioned to `active`

Status: Pass

## 3) active -> active -> 200 (idempotent, no DB write)

Input:

- First approve makes job active
- Second approve on same active job

Expected output:

- Both calls return HTTP 200
- No DB write on second call
- `updated_at` unchanged on second call

Actual result:

- Both calls returned HTTP 200
- `updated_at` unchanged on repeat call

Status: Pass

## 4) Invalid status transition -> 400

Input:

- Approve request for a job in a non-allowed future status (not `draft`, `closed`, `active`)

Expected output:

- HTTP 400
- Message: `Invalid status transition`
- No DB update write

Actual result:

- Logic path validated in service:
  - non-allowed status throws `badRequest('Invalid status transition')` before model call

Status: Pass



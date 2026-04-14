# ALL-REGISTRATION-FLOWS VERIFICATION REPORT

**Generated:** 2026-03-03 | **Last Updated:** 2026-03-03 (all fixes applied + CRUD verification)
**Scope:** Every creation/registration flow across 6 layers
**Layers:** DB Schema → Zod Validator → API Route → Frontend Hook → Frontend Form → Shared DTO

---

## Summary

| Severity   | Count | Description                                                                                 |
| ---------- | ----- | ------------------------------------------------------------------------------------------- |
| ✅ FIXED   | 30    | 14 critical DTO + 3 legacy validators + 6 functional verification + 7 CRUD update DTO fixes |
| 🟡 WARNING | 0     | All resolved — previously deferred items confirmed aligned or removed                       |
| 🟢 OK      | 8     | Entities with full alignment across all layers                                              |

### Fixes Applied (2026-03-03)

**DTO Files Fixed (6):**

- `packages/types/src/dto/education.dto.ts` — Fixed Content (5 missing fields), Quiz (field renames + removed questions), Statutory (3 renames + 2 missing), TBM (3 renames + added leaderId)
- `packages/types/src/dto/action.dto.ts` — Made `priority` optional, added `description`
- `packages/types/src/dto/post.dto.ts` — Added `imageHashes?: (string | null)[]`
- `packages/types/src/dto/auth.dto.ts` — Minor alignment fixes
- `packages/types/src/dto/points.dto.ts` — Minor alignment fixes

**Validator Cleanup (1 file):**

- `apps/api/src/validators/schemas/domain.ts` — Removed 3 legacy schemas: `CreateQuizSchema`, `CreateStatutoryTrainingSchema`, `CreateTbmRecordSchema`

**Runtime Safety Fixes (3 files):**

- `apps/admin/src/lib/api.ts` — Added refresh mutex (prevents concurrent 401 race), 30s fetch timeout via AbortController
- `apps/admin/src/app/rewards/components/criteria-tab.tsx` — Added AlertDialog confirmation before delete
- `apps/admin/src/app/education/components/tbm-tab/index.tsx` + `content-list.tsx` — Replaced empty catch blocks with toast error handling

**Tests Updated (2 files):**

- `apps/admin/src/lib/__tests__/api.test.ts` — Updated assertions for AbortController signal
- `apps/admin/src/app/rewards/components/__tests__/criteria-tab.test.tsx` — Added AlertDialog mocks, 2-step delete flow

**Verification:** 6/6 workspaces typecheck clean. Admin: 79 test files, 326 tests passing.

### Fixes Applied — Functional Verification Phase (2026-03-03)

**Education Content phantom fields removed (2 files):**

- `packages/types/src/dto/education.dto.ts` — Removed `contentBody?`, `sortOrder?` from `CreateEducationContentDto`; removed duplicate `sourceUrl` from `EducationContentDto`
- `apps/api/src/validators/schemas/domain.ts` — Removed `contentBody`, `sortOrder` from `CreateCourseSchema`

**TBM Response DTO alignment (1 file):**

- `packages/types/src/dto/education.dto.ts` — `TbmRecordDto`: removed phantom `location`/`conductorId`, renamed `tbmDate`→`date`, `weatherInfo`→`weatherCondition`, `safetyIssues`→`specialNotes`, removed `attendeeIds`. `TbmRecordListDto`: removed phantom `location`/`conductorName`, renamed `tbmDate`→`date`. `TbmRecordFilterDto`: `conductorId`→`leaderId`.

**Quiz Attempt type widening (1 file):**

- `packages/types/src/dto/education.dto.ts` — `SubmitQuizAttemptDto.answers` + `QuizAttemptDto.answers`: `number[]` → `(number | number[] | string)[]`

**Validator fixes (1 file):**

- `apps/api/src/validators/schemas/domain.ts` — Removed dead `UpdateTbmRecordSchema`; removed phantom `note` from `ManualCheckinSchema`; `CastVoteSchema`: removed phantom `month`, made `siteId` optional

**Tests updated (2 files):**

- `packages/types/src/__tests__/dto-shapes.test.ts` — Updated TBM/Content fixtures
- `apps/api/src/validators/__tests__/schemas.test.ts` — Removed `UpdateTbmRecordSchema` test; updated `ManualCheckinSchema`/`CastVoteSchema` fixtures

### Fixes Applied — CRUD Update DTO Verification Phase (2026-03-03)

**Update DTOs fixed/added (4 files):**

- `packages/types/src/dto/education.dto.ts` — Expanded `UpdateStatutoryTrainingDto` from 4→9 fields (added trainingType, trainingName, trainingDate, expirationDate, hoursCompleted); added `UpdateEducationContentDto` (9 fields), `UpdateQuizDto` (7 fields), `UpdateTbmRecordDto` (5 fields)
- `packages/types/src/dto/user.dto.ts` — Fixed `UpdateProfileDto`: renamed `nameMasked` → `name` (client sends `name`, server computes `nameMasked`)
- `packages/types/src/dto/site.dto.ts` — Added `UpdateSiteDto` (3 fields: name?, active?, leaderboardEnabled?)
- `packages/types/src/dto/points.dto.ts` — Added `UpdatePolicyDto` (8 fields: name?, description?, defaultAmount?, minAmount?, maxAmount?, dailyLimit?, monthlyLimit?, isActive?)

**Tests updated (1 file):**

- `packages/types/src/__tests__/dto-shapes.test.ts` — Added imports/fixtures for all 6 new/changed Update DTOs (UpdateProfileDto, UpdateStatutoryTrainingDto, UpdateSiteDto, UpdatePolicyDto, UpdateEducationContentDto, UpdateQuizDto)

**Verification:** 6/6 workspaces typecheck clean. 219 files, 1897 tests passing.

### Legend

- **DB** = `apps/api/src/db/schema.ts` column
- **Zod** = `apps/api/src/validators/schemas/domain.ts` or `auth.ts` schema
- **Route** = `apps/api/src/routes/` POST handler
- **Hook** = `apps/admin/src/hooks/` or `apps/worker/src/hooks/` mutation
- **Form** = Frontend form component fields sent
- **DTO** = `packages/types/src/dto/` TypeScript interface

---

## 1. User Registration (Auth)

**Route:** `POST /api/auth/register` → `apps/api/src/routes/auth/register.ts`
**Validator:** `RegisterSchema` (auth.ts)
**DB Table:** `users`

| Field    | DB Column                        | Zod Validator                    | DTO                      |
| -------- | -------------------------------- | -------------------------------- | ------------------------ |
| name     | `name` ✅                        | `name: nonEmptyStr` ✅           | ❌ No RegisterDto exists |
| phone    | `phone_encrypted` / `phone_hash` | `phone: string (11 digits)` ✅   | ❌                       |
| dob      | `dob_encrypted` / `dob_hash`     | `dob: string (6\|8 digits)` ✅   | ❌                       |
| deviceId | → `device_registrations` table   | `deviceId: string.optional()` ✅ | ❌                       |

**Findings:**

- 🟡 **No `RegisterDto`** in `packages/types/src/dto/auth.dto.ts`. Auth types only have OTP/token/response shapes.
- 🟢 Validator ↔ DB alignment is correct (phone/dob get encrypted server-side before insert).
- 🟢 Worker login form sends correct fields (`name`, `phone`, `dob`).

---

## 2. Post Creation

**Route:** `POST /api/posts` → `apps/api/src/routes/posts/crud-routes.ts`
**Validator:** `CreatePostSchema` (domain.ts L26-40)
**DB Table:** `posts` + `post_images`
**DTO:** `CreatePostDto` (post.dto.ts)

| Field          | DB Column                  | Zod Validator                    | Shared DTO                   | Status |
| -------------- | -------------------------- | -------------------------------- | ---------------------------- | ------ |
| siteId         | `site_id` ✅               | `siteId: uuid` ✅                | `siteId: string` ✅          | 🟢     |
| category       | `category` ✅              | `category: enum` ✅              | `category: Category` ✅      | 🟢     |
| content        | `content` ✅               | `content: nonEmptyStr` ✅        | `content: string` ✅         | 🟢     |
| hazardType     | `hazard_type` ✅           | `hazardType: string.opt` ✅      | `hazardType?: string` ✅     | 🟢     |
| riskLevel      | `risk_level` ✅            | `riskLevel: enum.opt` ✅         | `riskLevel?: RiskLevel` ✅   | 🟢     |
| locationFloor  | `location_floor` ✅        | `locationFloor: str.opt` ✅      | `locationFloor?: string` ✅  | 🟢     |
| locationZone   | `location_zone` ✅         | `locationZone: str.opt` ✅       | `locationZone?: string` ✅   | 🟢     |
| locationDetail | `location_detail` ✅       | `locationDetail: str.opt` ✅     | `locationDetail?: string` ✅ | 🟢     |
| visibility     | `visibility` ✅            | `visibility: enum.opt` ✅        | `visibility?: Visibility` ✅ | 🟢     |
| isAnonymous    | `is_anonymous` ✅          | `isAnonymous: bool.opt` ✅       | `isAnonymous?: boolean` ✅   | 🟢     |
| imageUrls      | → `post_images.file_url`   | `imageUrls: string[].opt` ✅     | `imageUrls?: string[]` ✅    | 🟢     |
| imageHashes    | → `post_images.image_hash` | `imageHashes: nullable[].opt` ✅ | ❌ **MISSING**               | 🔴     |
| metadata       | `metadata` (json) ✅       | `metadata: record.opt` ✅        | `metadata?: Record` ✅       | 🟢     |

**Findings:**

- 🔴 **`imageHashes` missing from `CreatePostDto`** — Validator accepts it, route handler processes it, DB stores it in `post_images.image_hash`, but DTO doesn't declare it. Worker form sends image hashes for duplicate detection.

---

## 3. Action Creation

**Route:** `POST /api/actions` → `apps/api/src/routes/actions/crud-routes.ts`
**Validator:** `CreateActionSchema` (domain.ts L57-64)
**DB Table:** `actions`
**DTO:** `CreateActionDto` (action.dto.ts)

| Field        | DB Column             | Zod Validator                 | Shared DTO                         | Status |
| ------------ | --------------------- | ----------------------------- | ---------------------------------- | ------ |
| postId       | `post_id` ✅          | `postId: uuid` ✅             | `postId: string` ✅                | 🟢     |
| assigneeType | `assignee_type` ✅    | `assigneeType: str.min(1)` ✅ | `assigneeType: string` ✅          | 🟢     |
| assigneeId   | `assignee_id` ✅      | `assigneeId: uuid.opt` ✅     | `assigneeId?: string` ✅           | 🟢     |
| dueDate      | `due_date` ✅         | `dueDate: isoDate.opt` ✅     | `dueDate?: string` ✅              | 🟢     |
| priority     | `priority` (opt enum) | `priority: enum.opt` ✅       | `priority: ActionPriority` **REQ** | 🔴     |
| description  | `description` ✅      | `description: str.opt` ✅     | ❌ **MISSING**                     | 🔴     |

**Findings:**

- 🔴 **`priority` optionality mismatch** — DB column is nullable, Zod validator marks it optional, but DTO declares it as **required** (`priority: ActionPriority`). Frontend must always send it even though API doesn't require it.
- 🔴 **`description` missing from `CreateActionDto`** — DB has the column, validator accepts it, route processes it, but DTO doesn't declare it.

---

## 4. Site Creation

**Route:** `POST /api/sites` → `apps/api/src/routes/sites.ts`
**Validator:** `CreateSiteSchema` (domain.ts L74-77)
**DB Table:** `sites`
**DTO:** `CreateSiteDto` (site.dto.ts)

| Field            | DB Column              | Zod Validator                   | Shared DTO                      | Status |
| ---------------- | ---------------------- | ------------------------------- | ------------------------------- | ------ |
| name             | `name` ✅              | `name: nonEmptyStr` ✅          | `name: string` ✅               | 🟢     |
| requiresApproval | `requires_approval` ✅ | `requiresApproval: bool.opt` ✅ | `requiresApproval?: boolean` ✅ | 🟢     |

**Findings:**

- 🟢 **Full alignment** across all layers. `joinCode` is auto-generated server-side.

---

## 5. Announcement Creation

**Route:** `POST /api/announcements` → `apps/api/src/routes/announcements.ts`
**Validator:** `CreateAnnouncementSchema` (domain.ts L149-155)
**DB Table:** `announcements`
**DTO:** `CreateAnnouncementDto` (announcement.dto.ts)

| Field       | DB Column         | Zod Validator                  | Shared DTO                      | Status |
| ----------- | ----------------- | ------------------------------ | ------------------------------- | ------ |
| siteId      | `site_id` ✅      | `siteId: uuid` ✅              | `siteId: string` ✅             | 🟢     |
| title       | `title` ✅        | `title: nonEmptyStr` ✅        | `title: string` ✅              | 🟢     |
| content     | `content` ✅      | `content: nonEmptyStr` ✅      | `content: string` ✅            | 🟢     |
| isPinned    | `is_pinned` ✅    | `isPinned: bool.opt` ✅        | `isPinned?: boolean` ✅         | 🟢     |
| scheduledAt | `scheduled_at` ✅ | `scheduledAt: datetime.opt` ✅ | `scheduledAt?: string\|null` ✅ | 🟢     |

**Findings:**

- 🟢 **Full alignment.** `authorId` is injected server-side from auth context.

---

## 6. Policy Creation (Point Policies)

**Route:** `POST /api/policies` → `apps/api/src/routes/policies.ts`
**Validator:** `CreatePolicySchema` (domain.ts L103-113)
**DB Table:** `point_policies`
**DTO:** No dedicated CreatePolicyDto exists

| Field         | DB Column           | Zod Validator                 | Status |
| ------------- | ------------------- | ----------------------------- | ------ |
| siteId        | `site_id` ✅        | `siteId: uuid` ✅             | 🟢     |
| reasonCode    | `reason_code` ✅    | `reasonCode: str.min(1)` ✅   | 🟢     |
| name          | `name` ✅           | `name: nonEmptyStr` ✅        | 🟢     |
| description   | `description` ✅    | `description: str.opt` ✅     | 🟢     |
| defaultAmount | `default_amount` ✅ | `defaultAmount: number` ✅    | 🟢     |
| minAmount     | `min_amount` ✅     | `minAmount: number.opt` ✅    | 🟢     |
| maxAmount     | `max_amount` ✅     | `maxAmount: number.opt` ✅    | 🟢     |
| dailyLimit    | `daily_limit` ✅    | `dailyLimit: number.opt` ✅   | 🟢     |
| monthlyLimit  | `monthly_limit` ✅  | `monthlyLimit: number.opt` ✅ | 🟢     |

**Findings:**

- 🟡 **No shared DTO** — Admin hook uses local type. Validator ↔ DB alignment is correct.
- 🟢 Validator-to-DB alignment is perfect.

---

## 7. Dispute Creation

**Route:** `POST /api/disputes` → `apps/api/src/routes/disputes.ts`
**Validator:** `CreateDisputeSchema` (domain.ts L128-136)
**DB Table:** `disputes`
**DTO:** No dedicated CreateDisputeDto

| Field             | DB Column                 | Zod Validator                    | Status |
| ----------------- | ------------------------- | -------------------------------- | ------ |
| siteId            | `site_id` ✅              | `siteId: uuid` ✅                | 🟢     |
| type              | `type` ✅                 | `type: enum` ✅                  | 🟢     |
| title             | `title` ✅                | `title: nonEmptyStr` ✅          | 🟢     |
| description       | `description` ✅          | `description: nonEmptyStr` ✅    | 🟢     |
| refReviewId       | `ref_review_id` ✅        | `refReviewId: uuid.opt` ✅       | 🟢     |
| refPointsLedgerId | `ref_points_ledger_id` ✅ | `refPointsLedgerId: uuid.opt` ✅ | 🟢     |
| refAttendanceId   | `ref_attendance_id` ✅    | `refAttendanceId: uuid.opt` ✅   | 🟢     |

**Findings:**

- 🟢 **Full alignment.** `userId` injected server-side. `status` defaults to `OPEN` in DB.

---

## 8. Vote Casting

**Route:** `POST /api/votes` → `apps/api/src/routes/votes.ts`
**Validator:** `CastVoteSchema` (domain.ts L166-170)
**DB Table:** `votes`

| Field       | DB Column         | Zod Validator          | Status |
| ----------- | ----------------- | ---------------------- | ------ |
| siteId      | `site_id` ✅      | `siteId: uuid.opt` ✅  | 🟢     |
| candidateId | `candidate_id` ✅ | `candidateId: uuid` ✅ | 🟢     |

**Findings:**

- 🟢 **Full alignment.** `voterId` injected server-side. `month` computed from active period (removed from validator). `siteId` made optional to match handler behavior.

---

## 9. Vote Candidate Creation (Admin)

**Route:** `POST /api/admin/votes/candidates` → `apps/api/src/routes/admin/votes.ts`
**Validator:** `AdminCreateVoteCandidateSchema` (domain.ts L206-211)
**DB Table:** `vote_candidates`
**DTO:** `CreateVoteCandidateDto` (vote.dto.ts)

| Field  | DB Column           | Zod Validator         | Shared DTO                        | Status |
| ------ | ------------------- | --------------------- | --------------------------------- | ------ |
| userId | `user_id` ✅        | `userId: uuid` ✅     | `userId: string` ✅               | 🟢     |
| siteId | `site_id` ✅        | `siteId: uuid` ✅     | `siteId: string` ✅               | 🟢     |
| month  | `month` ✅          | `month: YYYY-MM` ✅   | `month: string` ✅                | 🟢     |
| source | `source` (req enum) | `source: enum.opt` ✅ | `source?: VoteCandidateSource` ✅ | 🟢     |

**Findings:**

- 🟢 **Full alignment.** Source defaults to `"ADMIN"` in route handler when not specified.

---

## 10. Education Content Creation

**Route:** `POST /api/education/contents` → `apps/api/src/routes/education/contents.ts`
**Validator:** `CreateCourseSchema` (domain.ts L261-274)
**DB Table:** `education_contents`
**DTO:** `CreateEducationContentDto` (education.dto.ts)

| Field           | DB Column             | Zod Validator                 | Shared DTO                             | Status |
| --------------- | --------------------- | ----------------------------- | -------------------------------------- | ------ |
| siteId          | `site_id` ✅          | `siteId: uuid` ✅             | `siteId: string` ✅                    | 🟢     |
| title           | `title` ✅            | `title: nonEmptyStr` ✅       | `title: string` ✅                     | 🟢     |
| description     | `description` ✅      | `description: str.opt` ✅     | `description?: string` ✅              | 🟢     |
| contentType     | `content_type` ✅     | `contentType: enum` ✅        | `contentType: EducationContentType` ✅ | 🟢     |
| contentUrl      | `content_url` ✅      | `contentUrl: str.opt` ✅      | `contentUrl?: string` ✅               | 🟢     |
| thumbnailUrl    | `thumbnail_url` ✅    | `thumbnailUrl: str.opt` ✅    | ❌ **MISSING**                         | 🔴     |
| durationMinutes | `duration_minutes` ✅ | `durationMinutes: int.opt` ✅ | ❌ **MISSING**                         | 🔴     |
| externalSource  | `external_source` ✅  | `externalSource: enum.opt` ✅ | ❌ **MISSING**                         | 🔴     |
| externalId      | `external_id` ✅      | `externalId: str.opt` ✅      | ❌ **MISSING**                         | 🔴     |
| sourceUrl       | `source_url` ✅       | `sourceUrl: str.opt` ✅       | ❌ **MISSING**                         | 🔴     |
| ~~contentBody~~ | ❌ **NOT IN DB**      | ~~removed~~ ✅                | ~~removed~~ ✅                         | ✅     |
| ~~sortOrder~~   | ❌ **NOT IN DB**      | ~~removed~~ ✅                | ~~removed~~ ✅                         | ✅     |

**Findings:**

- ✅ ~~5 fields missing from DTO~~ — All added: `thumbnailUrl`, `durationMinutes`, `externalSource`, `externalId`, `sourceUrl`.
- ✅ ~~2 phantom fields~~ — `contentBody` and `sortOrder` removed from both validator and DTO (no DB column existed).
- 🟡 `UpdateCourseSchema` is also missing the 5 fields (only has title, description, contentType, contentUrl) — deferred.

---

## 11. Quiz Creation (Admin)

**Route:** `POST /api/education/quizzes` → `apps/api/src/routes/education/quizzes.ts`
**Validator (ACTUAL):** `CreateQuizInputSchema` (domain.ts L368-377)
**Validator (LEGACY):** `CreateQuizSchema` (domain.ts L285-308) — **NOT used by route**
**DB Table:** `quizzes`
**DTO:** `CreateQuizDto` (education.dto.ts)

| Field            | DB Column               | Actual Validator               | Legacy Validator  | Shared DTO         | Status |
| ---------------- | ----------------------- | ------------------------------ | ----------------- | ------------------ | ------ |
| siteId           | `site_id` ✅            | `siteId: uuid` ✅              | `siteId` ✅       | `siteId` ✅        | 🟢     |
| contentId        | `content_id` ✅         | `contentId: uuid.opt` ✅       | `contentId` ✅    | `contentId?` ✅    | 🟢     |
| title            | `title` ✅              | `title: nonEmptyStr` ✅        | `title` ✅        | `title` ✅         | 🟢     |
| description      | `description` ✅        | `description: str.opt` ✅      | `description` ✅  | `description?` ✅  | 🟢     |
| status           | `status` (DRAFT) ✅     | `status: enum.opt` ✅          | ❌                | ❌                 | 🟡     |
| pointsReward     | `points_reward` ✅      | `pointsReward: int.opt` ✅     | `pointsReward` ✅ | `pointsReward?` ✅ | 🟢     |
| passingScore     | `passing_score` ✅      | `passingScore: int.opt` ✅     | ❌ `passScore`    | ❌ `passScore?`    | 🔴     |
| timeLimitMinutes | `time_limit_minutes` ✅ | `timeLimitMinutes: int.opt` ✅ | ❌ `timeLimitSec` | ❌ `timeLimitSec?` | 🔴     |
| questions        | N/A (separate table)    | ❌ not accepted                | `questions[]` ✅  | `questions[]` ✅   | 🔴     |

**Findings:**

- 🔴 **DTO uses wrong field names** — `passScore` should be `passingScore`, `timeLimitSec` should be `timeLimitMinutes`. DTO matches the LEGACY validator, not the actual one used by routes.
- 🔴 **DTO includes `questions[]`** but the actual route validator (`CreateQuizInputSchema`) does NOT accept questions. Quiz questions are created via separate endpoint `POST /api/education/quizzes/:id/questions`.
- 🟡 **Duplicate validators** — `CreateQuizSchema` (legacy, with questions) and `CreateQuizInputSchema` (actual, without questions) coexist. Legacy should be removed.
- 🟡 **DTO missing `status`** — Actual validator accepts it, DB has it.

---

## 12. Quiz Attempt Submission

**Route:** `POST /api/education/quiz-attempts` → `apps/api/src/routes/education/quiz-attempts.ts`
**Validator:** `SubmitQuizSchema` (domain.ts L310-317)
**DB Table:** `quiz_attempts`
**DTO:** `SubmitQuizAttemptDto` (education.dto.ts)

| Field     | DB Column           | Zod Validator                     | Shared DTO                                 | Status |
| --------- | ------------------- | --------------------------------- | ------------------------------------------ | ------ |
| quizId    | `quiz_id` ✅        | `quizId: uuid` ✅                 | `quizId: string` ✅                        | 🟢     |
| siteId    | `site_id` ✅        | `siteId: uuid` ✅                 | `siteId: string` ✅                        | 🟢     |
| answers   | `answers` (json) ✅ | `answers: (int\|int[]\|str)[]` ✅ | `answers: (number\|number[]\|string)[]` ✅ | 🟢     |
| startedAt | `started_at` ✅     | `startedAt: isoDateStr` ✅        | `startedAt: string` ✅                     | 🟢     |

**Findings:**

- ✅ ~~`answers` type mismatch~~ — DTO widened from `number[]` to `(number | number[] | string)[]` to match DB/validator, supporting SINGLE_CHOICE, MULTI_CHOICE, and SHORT_ANSWER quiz types.

---

## 13. Statutory Training Creation (Admin)

**Route:** `POST /api/education/statutory` → `apps/api/src/routes/education/statutory.ts`
**Validator (ACTUAL):** `CreateStatutoryTrainingInputSchema` (domain.ts L379-391)
**Validator (LEGACY):** `CreateStatutoryTrainingSchema` (domain.ts L319-329) — **NOT used by route**
**DB Table:** `statutory_trainings`
**DTO:** `CreateStatutoryTrainingDto` (education.dto.ts)

| Field          | DB Column               | Actual Validator                 | DTO Field          | Status |
| -------------- | ----------------------- | -------------------------------- | ------------------ | ------ |
| siteId         | `site_id` ✅            | `siteId` ✅                      | `siteId` ✅        | 🟢     |
| userId         | `user_id` ✅            | `userId` ✅                      | `userId` ✅        | 🟢     |
| trainingType   | `training_type` ✅      | `trainingType: enum` ✅          | `trainingType` ✅  | 🟢     |
| trainingName   | `training_name` ✅      | `trainingName` ✅                | `trainingName` ✅  | 🟢     |
| trainingDate   | `training_date` ✅      | `trainingDate: isoDate` ✅       | ❌ `scheduledDate` | 🔴     |
| expirationDate | `expiration_date` ✅    | `expirationDate: isoDate.opt` ✅ | ❌ `expiryDate?`   | 🔴     |
| hoursCompleted | `hours_completed` ✅    | `hoursCompleted: num.opt` ✅     | ❌ `trainingHours` | 🔴     |
| provider       | `provider` ✅           | `provider: str.opt` ✅           | `provider?` ✅     | 🟢     |
| certificateUrl | `certificate_url` ✅    | `certificateUrl: str.opt` ✅     | ❌ **MISSING**     | 🔴     |
| status         | `status` (SCHEDULED) ✅ | `status: enum.opt` ✅            | ❌ **MISSING**     | 🔴     |
| notes          | `notes` ✅              | `notes: str.opt` ✅              | `notes?` ✅        | 🟢     |

**Findings:**

- 🔴 **3 field name mismatches** — DTO uses legacy names that don't match DB or actual validator:
  - `scheduledDate` → should be `trainingDate`
  - `expiryDate` → should be `expirationDate`
  - `trainingHours` → should be `hoursCompleted`
- 🔴 **2 fields missing from DTO** — `certificateUrl` and `status` exist in DB and actual validator.
- 🟡 **Duplicate validators** — Legacy `CreateStatutoryTrainingSchema` coexists with actual `CreateStatutoryTrainingInputSchema`.

---

## 14. TBM Record Creation (Admin)

**Route:** `POST /api/education/tbm` → `apps/api/src/routes/education/tbm.ts`
**Validator (ACTUAL):** `CreateTbmInputSchema` (domain.ts L393-401)
**Validator (LEGACY):** `CreateTbmRecordSchema` (domain.ts L343-352) — **NOT used by route**
**DB Table:** `tbm_records` + `tbm_attendees`
**DTO:** `CreateTbmRecordDto` (education.dto.ts)

| Field            | DB Column              | Actual Validator               | DTO Field          | Status |
| ---------------- | ---------------------- | ------------------------------ | ------------------ | ------ |
| siteId           | `site_id` ✅           | `siteId` ✅                    | `siteId` ✅        | 🟢     |
| date             | `date` ✅              | `date: isoDate` ✅             | ❌ `tbmDate`       | 🔴     |
| topic            | `topic` ✅             | `topic: nonEmptyStr` ✅        | `topic` ✅         | 🟢     |
| content          | `content` ✅           | `content: str.opt` ✅          | `content?` ✅      | 🟢     |
| leaderId         | `leader_id` ✅         | `leaderId: uuid.opt` ✅        | ❌ **MISSING**     | 🔴     |
| weatherCondition | `weather_condition` ✅ | `weatherCondition: str.opt` ✅ | ❌ `weatherInfo?`  | 🔴     |
| specialNotes     | `special_notes` ✅     | `specialNotes: str.opt` ✅     | ❌ `safetyIssues?` | 🔴     |
| ~~location~~     | ❌ **NOT IN DB**       | ❌ not accepted                | ~~removed~~ ✅     | ✅     |
| ~~attendeeIds~~  | → `tbm_attendees`      | ❌ not accepted                | ~~removed~~ ✅     | ✅     |

**Findings:**

- 🔴 **3 field name mismatches** — DTO uses completely different names:
  - `tbmDate` → should be `date`
  - `weatherInfo` → should be `weatherCondition`
  - `safetyIssues` → should be `specialNotes`
- 🔴 **`leaderId` missing from DTO** — DB requires it, actual validator accepts it.
- ✅ ~~`location` is phantom~~ — Removed from DTO.
- ✅ ~~`attendeeIds` approach differs~~ — Removed from DTO (actual route creates attendees separately).
- 🟡 ~~Duplicate validators~~ — Legacy `CreateTbmRecordSchema` removed. Also removed dead `UpdateTbmRecordSchema`.

---

## 15. Points Award

**Route:** `POST /api/points/award` → `apps/api/src/routes/points.ts`
**Validator:** `AwardPointsSchema` (domain.ts L92-99)
**DB Table:** `points_ledger`
**DTO:** `AwardPointsDto` (points.dto.ts)

| Field      | DB Column        | Zod Validator               | Shared DTO               | Status |
| ---------- | ---------------- | --------------------------- | ------------------------ | ------ |
| userId     | `user_id` ✅     | `userId: uuid` ✅           | `userId: string` ✅      | 🟢     |
| siteId     | `site_id` ✅     | `siteId: uuid` ✅           | `siteId: string` ✅      | 🟢     |
| postId     | `post_id` ✅     | `postId: uuid.opt` ✅       | `postId?: string` ✅     | 🟢     |
| amount     | `amount` ✅      | `amount: int` ✅            | `amount: number` ✅      | 🟢     |
| reasonCode | `reason_code` ✅ | `reasonCode: str.min(1)` ✅ | `reasonCode: string` ✅  | 🟢     |
| reasonText | `reason_text` ✅ | `reasonText: str.opt` ✅    | `reasonText?: string` ✅ | 🟢     |

**Findings:**

- 🟢 **Full alignment.** `adminId` and `settleMonth` are injected server-side.

---

## 16. Vote Period Creation (Admin)

**Route:** `POST /api/admin/votes/periods` → `apps/api/src/routes/admin/votes.ts`
**Validator:** `AdminCreateVotePeriodSchema` (domain.ts L213-216)
**DB Table:** `vote_periods`
**DTO:** No shared DTO

| Field     | DB Column               | Zod Validator              | Status |
| --------- | ----------------------- | -------------------------- | ------ |
| startDate | `start_date` (epoch) ✅ | `startDate: isoDateStr` ✅ | 🟢     |
| endDate   | `end_date` (epoch) ✅   | `endDate: isoDateStr` ✅   | 🟢     |

**Findings:**

- 🟢 Validator-to-DB aligned. `siteId` and `month` derived server-side from context/date range.
- 🟡 **No shared DTO** — Admin hook uses local type.

---

## 17. Review Action (Admin)

**Route:** `POST /api/reviews` → `apps/api/src/routes/reviews.ts`
**Validator:** `ReviewActionSchema` (domain.ts L48-53)
**DB Table:** `reviews`
**DTO:** `ReviewActionDto` (review.dto.ts)

| Field      | DB Column        | Zod Validator             | Shared DTO                     | Status |
| ---------- | ---------------- | ------------------------- | ------------------------------ | ------ |
| postId     | `post_id` ✅     | `postId: uuid` ✅         | `postId: string` ✅            | 🟢     |
| action     | `action` ✅      | `action: enum` ✅         | `action: ReviewAction` ✅      | 🟢     |
| comment    | `comment` ✅     | `comment: str.opt` ✅     | `comment?: string` ✅          | 🟢     |
| reasonCode | `reason_code` ✅ | `reasonCode: enum.opt` ✅ | `reasonCode?: RejectReason` ✅ | 🟢     |

**Findings:**

- 🟢 **Full alignment.** `adminId` injected server-side.

---

## 18. Manual Attendance Check-in

**Route:** `POST /api/attendance/manual` → `apps/api/src/routes/attendance/index.ts`
**Validator:** `ManualCheckinSchema` (domain.ts L405-409)
**DB Table:** `attendance`

| Field  | DB Column    | Zod Validator         | Status |
| ------ | ------------ | --------------------- | ------ |
| siteId | `site_id` ✅ | `siteId: uuid` ✅     | 🟢     |
| userId | `user_id` ✅ | `userId: uuid.opt` ✅ | 🟢     |

**Findings:**

- ✅ ~~`note` phantom field~~ — Removed from `ManualCheckinSchema` (no DB column).
- 🟢 `checkinAt`, `result`, `source` are set server-side.

---

## 19. Push Subscription

**Route:** `POST /api/notifications/subscribe` → `apps/api/src/routes/notifications.ts`
**Validator:** Inline validation in route handler
**DB Table:** `push_subscriptions`

| Field    | DB Column     | Route Expects                 | Status |
| -------- | ------------- | ----------------------------- | ------ |
| endpoint | `endpoint` ✅ | `subscription.endpoint` ✅    | 🟢     |
| p256dh   | `p256dh` ✅   | `subscription.keys.p256dh` ✅ | 🟢     |
| auth     | `auth` ✅     | `subscription.keys.auth` ✅   | 🟢     |

**Findings:**

- 🟡 **No shared Zod validator** — Route does inline validation of Web Push subscription object.
- 🟢 DB alignment correct. `userId` from auth context.

---

## 20. Recommendation Creation

**Route:** `POST /api/recommendations` → `apps/api/src/routes/recommendations.ts`
**Validator:** Inline validation in route handler
**DB Table:** `recommendations`

| Field              | DB Column                | Route Expects | Status |
| ------------------ | ------------------------ | ------------- | ------ |
| siteId             | `site_id` ✅             | Body field ✅ | 🟢     |
| recommendedName    | `recommended_name` ✅    | Body field ✅ | 🟢     |
| tradeType          | `trade_type` ✅          | Body field ✅ | 🟢     |
| reason             | `reason` ✅              | Body field ✅ | 🟢     |
| recommendationDate | `recommendation_date` ✅ | Body field ✅ | 🟢     |

**Findings:**

- 🟡 **No shared Zod validator or DTO** — Route does inline validation.
- 🟢 DB alignment correct. `recommenderId` from auth context.

---

## Critical Issues Summary

### ✅ CRITICAL — All Resolved (14/14 fixed)

| #   | Entity            | Issue                                                                                            | Impact                                            |
| --- | ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1   | Post              | `imageHashes` missing from `CreatePostDto`                                                       | DTO consumers can't type image hash submissions   |
| 2   | Action            | `priority` is REQUIRED in DTO but OPTIONAL in validator/DB                                       | Frontend forced to always provide priority        |
| 3   | Action            | `description` missing from `CreateActionDto`                                                     | Can't type description field through DTO          |
| 4   | Education Content | 5 fields missing from DTO (thumbnailUrl, durationMinutes, externalSource, externalId, sourceUrl) | Admin forms can't use shared DTO for these fields |
| 5   | Quiz              | DTO uses `passScore` instead of DB's `passingScore`                                              | Name mismatch causes confusion                    |
| 6   | Quiz              | DTO uses `timeLimitSec` instead of DB's `timeLimitMinutes`                                       | Unit mismatch (seconds vs minutes)                |
| 7   | Quiz              | DTO includes `questions[]` but actual route doesn't accept them                                  | Misleading API contract                           |
| 8   | Statutory         | DTO `scheduledDate` ≠ DB/validator `trainingDate`                                                | Field name mismatch                               |
| 9   | Statutory         | DTO `expiryDate` ≠ DB/validator `expirationDate`                                                 | Field name mismatch                               |
| 10  | Statutory         | DTO `trainingHours` ≠ DB/validator `hoursCompleted`                                              | Field name mismatch                               |
| 11  | Statutory         | `certificateUrl` + `status` missing from DTO                                                     | Can't type these fields                           |
| 12  | TBM               | DTO `tbmDate` ≠ DB/validator `date`                                                              | Field name mismatch                               |
| 13  | TBM               | DTO `weatherInfo`/`safetyIssues` ≠ DB `weatherCondition`/`specialNotes`                          | Field name mismatches                             |
| 14  | TBM               | `leaderId` missing from DTO                                                                      | Can't type leader assignment                      |

### 🟡 WARNING — All Resolved (11/11 fixed)

| #   | Entity            | Issue                                                                                                                 |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
|     | 1                 | Auth                                                                                                                  | ~~No `RegisterDto` in shared types~~ ✅ Already exists in `auth.dto.ts` — aligned with `RegisterSchema` |
| 2   | Education Content | ~~`contentBody` + `sortOrder` are phantom fields (no DB column)~~ ✅ Removed from DTO and validator                   |
| 3   | Quiz              | ~~Duplicate validators: `CreateQuizSchema` (legacy) vs `CreateQuizInputSchema` (actual)~~ ✅ Legacy removed           |
|     | 4                 | Quiz                                                                                                                  | ~~DTO missing `status` field~~ ✅ Added in P0 fix phase                                                 |
| 5   | Statutory         | ~~Duplicate validators: `CreateStatutoryTrainingSchema` (legacy) vs `CreateStatutoryTrainingInputSchema`~~ ✅ Removed |
| 6   | TBM               | ~~Duplicate validators: `CreateTbmRecordSchema` (legacy) vs `CreateTbmInputSchema` (actual)~~ ✅ Removed              |
| 7   | TBM               | ~~`location` + `attendeeIds` are phantom fields in DTO~~ ✅ Removed from DTOs                                         |
| 8   | Quiz Attempt      | ~~`answers` DTO type (`number[]`) narrower than DB/validator~~ ✅ Widened to `(number\|number[]\|string)[]`           |
|     | 9                 | Policy                                                                                                                | ~~No shared CreatePolicyDto~~ ✅ Already exists in `points.dto.ts` — aligned with `CreatePolicySchema`  |
| 10  | Attendance        | ~~`note` phantom field in validator (no DB column)~~ ✅ Removed from ManualCheckinSchema                              |
|     | 11                | Recommendation                                                                                                        | ~~No shared validator or DTO~~ ✅ Inline validator aligned with route handler — no shared DTO needed    |

---

## Recommended Fixes — Status

### ✅ P0 — DTO Field Alignment (ALL COMPLETED)

1. ✅ **`CreateStatutoryTrainingDto`** — Renamed `scheduledDate`→`trainingDate`, `expiryDate`→`expirationDate`, `trainingHours`→`hoursCompleted`. Added `certificateUrl?`, `status?`.
2. ✅ **`CreateTbmRecordDto`** — Renamed `tbmDate`→`date`, `weatherInfo`→`weatherCondition`, `safetyIssues`→`specialNotes`. Added `leaderId?`.
3. ✅ **`CreateQuizDto`** — Renamed `passScore`→`passingScore`, `timeLimitSec`→`timeLimitMinutes`. Removed `questions[]`. Added `status?`.
4. ✅ **`CreateEducationContentDto`** — Added `thumbnailUrl?`, `durationMinutes?`, `externalSource?`, `externalId?`, `sourceUrl?`.
5. ✅ **`CreateActionDto`** — Made `priority` optional. Added `description?: string`.
6. ✅ **`CreatePostDto`** — Added `imageHashes?: (string | null)[]`.

### ✅ P1 — Validator Cleanup (PARTIALLY COMPLETED)

7. ✅ Removed legacy validators: `CreateQuizSchema`, `CreateStatutoryTrainingSchema`, `CreateTbmRecordSchema`.
8. ✅ `UpdateCourseSchema` — Removed in PR #60 (dead code). Route uses local `UpdateEducationContentSchema`.

### ✅ P1.5 — CRUD Update DTO Alignment (ALL COMPLETED)

9. ✅ **`UpdateStatutoryTrainingDto`** — Expanded from 4→9 fields to match validator + DB.
10. ✅ **`UpdateProfileDto`** — Renamed `nameMasked` → `name` to match validator.
11. ✅ **`UpdateSiteDto`** — New. 3 fields matching `UpdateSiteSchema`.
12. ✅ **`UpdatePolicyDto`** — New. 8 fields matching `UpdatePolicySchema`.
13. ✅ **`UpdateEducationContentDto`** — New. 9 fields matching `UpdateCourseSchema`.
14. ✅ **`UpdateQuizDto`** — New. 7 fields matching `UpdateQuizInputSchema`.
15. ✅ **`UpdateTbmRecordDto`** — New. 5 fields matching `UpdateTbmInputSchema`.

### ✅ P2 — Missing Create DTOs (ALL VERIFIED)

16. ✅ `RegisterDto` — Already exists in `auth.dto.ts`, aligned with `RegisterSchema` (name, phone, dob, deviceId?).
17. ✅ `CreatePolicyDto` — Already exists in `points.dto.ts`, aligned with `CreatePolicySchema` (siteId, reasonCode, name, description?, defaultAmount, minAmount?, maxAmount?, dailyLimit?, monthlyLimit?).

---

## Entities with Full Alignment 🟢

These entities have correct field mapping across all layers:

1. **Site Creation** — CreateSiteDto ↔ CreateSiteSchema ↔ sites table
2. **Announcement Creation** — CreateAnnouncementDto ↔ CreateAnnouncementSchema ↔ announcements table
3. **Points Award** — AwardPointsDto ↔ AwardPointsSchema ↔ points_ledger table
4. **Vote Casting** — CastVoteSchema ↔ votes table
5. **Vote Candidate** — CreateVoteCandidateDto ↔ AdminCreateVoteCandidateSchema ↔ vote_candidates table
6. **Review Action** — ReviewActionDto ↔ ReviewActionSchema ↔ reviews table
7. **Dispute Creation** — CreateDisputeSchema ↔ disputes table
8. **Vote Period** — AdminCreateVotePeriodSchema ↔ vote_periods table

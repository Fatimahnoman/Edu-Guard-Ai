# Edu-Guard AI — Full Codebase Analysis Report

Date: 2026-09-24
Scope: entire repository (`src/`, `prisma/`, `docs/`, root configs)

## 1. Overview

**What it is:** A Next.js 14 (App Router) educational platform focused on Pakistan, combining:
- AI chat assistant (Groq, with Gemini/OpenRouter abstraction)
- Education discovery (universities, scholarships, schemes, courses, career paths, internships)
- Fraud/SCAM detection (SMS/URL/phone/document scanning, rule engine, AI classification)
- Budget planner, study planner, teacher workspace, document analysis
- Country intelligence (visa, costs, study-abroad), notifications, admin console

**Scale:** 335 TS + 104 TSX files in `src/` (~3.5 MB), ~174 API route files, 89 Prisma models, 14 seed files, 54+ unit test files. Claims in docs: "1010 passing tests", "154 API routes" — actual route count is ~174 files, and the test suite is smaller/rhetorical in places (see §7).

**Stack:** Next.js 14.2.35, React 18, TypeScript (strict), Tailwind CSS, Prisma 5 (PostgreSQL prod / SQLite dev), Groq AI + fallbacks, JWT (access 15m / refresh 7d), bcryptjs, Vitest.

---

## 2. Architecture — Strengths

- **Service-layer discipline.** Clear domain partitioning; every domain exports a singleton (`export const xxxService = new XxxService()`). Predictable; easy to mock.
- **Defense-in-depth auth.** Middleware gates protected API prefixes + every route calls `requireAuth`/`requireRole` again. Admin routes uniformly use `requireRole(request,'admin')`; teacher routes `requireRole(request,'teacher')`.
- **Ownership scoping** (IDOR protection) is solid in the majority of user-scoped resources: workspace, chat, documents, notifications, budget, study, teacher classrooms all scope queries by `userId` and belong-check before mutation.
- **AI resilience pattern.** LLM-first with deterministic fallbacks: 3-tier AI provider chain (`getAIProvider` → `getFallbackProvider` → `getSecondFallbackProvider`) plus heuristic scorers (fraud, document-intelligence, recommendation) — genuinely good graceful degradation.
- **Security hygiene basics are present and verified:** bcrypt 12 rounds, HS256 pinned, refresh-token rotation + reuse detection, hashed tokens at rest, SSRF protection, magic-byte file validation (in lib), credential redaction, anti-enumeration on password reset, admin self-protection (can't demote/ban self), strong edge headers (HSTS, nosniff, frame-deny), no SQL injection observed (Prisma parameterized), no frontend secrets leaked.
- **Data breadth is impressive:** 89 models, seeded Pakistani universities/schemes/scholarships, 46 scam types with trilingual complaint paths, country cost/visa data.

---

## 3. Critical Issues (fix first)

### CRITICAL — Security
1. **XSS → session theft.** `src/components/chat/ChatMessage.tsx:150` renders AI output through a homemade regex "markdown" parser with **no sanitization** via `dangerouslySetInnerHTML`. Model output with `<img onerror=…>` executes. Combined with tokens in `localStorage` (below) = full account takeover.
2. **Tokens in `localStorage`** (`src/providers/auth-provider.tsx`, `src/lib/api-client.ts:79-87`) — XSS-readable; refresh token should be httpOnly cookie.
3. **`.env.production` contains a live Vercel OIDC JWT** and is **not gitignored** (`.gitignore` only excludes `.env` and `.env*.local`). Remove it or gitignore `*.env` patterns.
4. **Hardcoded dev JWT secrets fallback** (`src/lib/jwt.ts:18-19`) — any non-production environment silently uses publicly-known secrets → token forgery.
5. **SSRF bypasses.** `isSafeUrl` doesn't catch IP encodings (`127.1`, integer/hex IPs, `.nip.io`); `isSafeUrlWithDns` and `validateRedirectUrl` are **never wired into production code**, while `url-analyzer.ts` follows redirects (`redirect:'follow'`) without re-validating each hop.
6. **No Content-Security-Policy** header anywhere (only a recommendation string in unwired `security-audit.ts`).

### CRITICAL — Broken features (frontend)
7. **Protected APIs called without Authorization header** → permanent 401s:
   - `teacher/page.tsx` (+ `teacher/lessons|homework|assessments`) — all call `/api/teacher/*` with raw fetch, no header.
   - `education/plan/page.tsx:48` — `/api/orchestrate` protected, no header.
   - `student/page.tsx:36` — `/api/student-assistant`, no header.
8. **Undefined design classes** (`bg-card`, `border-border`, `bg-dark`) used on `dashboard`, `education/timeline`, `education/scholarships/match`, `fraud/reporting` pages — they don't exist in globals.css/tailwind → dark-on-dark render bugs.

### HIGH — Privacy / Authz
9. **Privacy-engine bypass.** `student-assistant.service.ts:124` builds the AI context string from the **full unfiltered profile** (income, savings, fraud history) — the privacy filter is only applied to a separate unused `privacyFilteredContext` field. Defeats the entire privacy design.
10. **`DocumentService.updateStatus` has no userId scoping** (`documents/service.ts:50-55`) — any authenticated user can change any document's status (IDOR).
11. **`financial-education.service.ts:374` auto-populate** — plan lookup without userId scope (IDOR) + no idempotency (duplicates items on repeat).
12. **Cross-user data exposure:** `sources/route.ts` GET returns other users' sources; `sources/stats`, `sources/expired`, `verification/entity`, `verification/scheduled` (job trigger) usable by any user.

### HIGH — Bugs
13. **Streaming loop terminates after first chunk** (`ai/provider.ts:142`, `openrouter-provider.ts:83`): `chunk.choices[0]?.finish_reason !== null` is `true` when `finish_reason` is `undefined`.
14. **Education planner drops the field filter** (`orchestration/education-planner.ts:8-11`): `courseWhere.degree` is set for `field` then overwritten for `degreeLevel`.
15. **Fabricated metrics:** `system-admin.service.ts:793-794` synthesizes p95 = avg×2, p99 = avg×3; not real percentiles.
16. **Model default mismatch:** `ai.service.ts` defaults `openai/gpt-oss-20b`, `ai/index.ts` defaults `openai/gpt-oss-120b` — inconsistent cost/quality by call path.
17. **`source.service.ts:139` duration bug** — logs epoch timestamp instead of elapsed ms on failure; misleading `method:'http_head'` audit rows.
18. **Dead code shipped:** entire `education/education.service.ts` (never imported, duplicates university/scholarship search); `url-analyzer.ts:409` `calculateRiskScore` unused; `teacher.service.ts:60` `getStudentProfiles` returns `[]`.

---

## 4. Architecture — Weaknesses

1. **No repository/DAL.** Every service queries the Prisma singleton directly; schema changes ripple everywhere.
2. **Hardcoded data masquerading as intelligence.** Thousands of lines of reference data compiled into source: 2025 Pakistan scam stats (unverifiable citations), ~30 reporting authorities, **~5,100-line `complaint-paths.ts`**, tuition ranges, ~60 fraud rules. Data that should be seeded; will age and contradict the DB.
3. **Module-load crash risk:** `scam-types-registry.ts` uses 46 non-null assertions (`getComplaintPathForType('…')!`) — any typo in a scam-type string throws at import.
4. **In-memory state in services** (`document-intelligence` Maps; `phone-lookup` 30-min cache) — lost on restart, per-instance under serverless.
5. **Weak typing in mappers:** pervasive `any` / `Record<string, unknown>` + `String()` / `as unknown as` casts in ~8 domains (budget, workspace, teacher, study, financial-education, notification, country-intelligence) — loses the benefit of Prisma's generated types.
6. **Audit duplication:** three audit writers (auth `audit.service`, `audit-trail.service`, and `system-admin.service` re-implements both).
7. **All-client frontend:** 76/76 pages are `'use client'`; zero server components, zero SSR/metadata/SEO, blank-flash + refetch-per-mount everywhere. `/api/education/*` reads (public) are prime RSC candidates.
8. **Two chat systems:** `/chat` persists server-side; 6 department chats persist to localStorage — separate histories the user can't reconcile.
9. **Validation triplicated:** `lib/utils/validation.ts` (8 routes), `lib/api-validation.ts` (dead — zero usages), plus inline ad-hoc checks everywhere else. Route param IDs never validated → generic 500s on bad IDs.
10. **Rate limiting mostly unwired:** `AI_RATE_LIMITS`, `OUTBOUND_RATE_LIMITS`, `GLOBAL_RATE_LIMIT` defined but used by no route; `/api/auth/refresh` unlimited; `fraud/scan`, `urls/scan`, `documents/upload/analyze`, admin ops unprotected. In-memory store = per-instance (serverless bypass) + XFF-spoofable keys.

---

## 5. Database Layer Findings

- **89 models, ZERO enums** — all role/status/severity fields are raw `String`; no DB-level domain constraint.
- **Two parallel country models** — `Country` (8 rows) vs `CountryProfile` (40+ rows), overlapping names/codes, separate seeds, no relation. Root cause of `seed-data.test.ts` failures.
- **Orphan-capable FKs (no `@relation`):** `UserReport.fraudReportId/urlScanId`, `ApplicationChecklist.universityId/scholarshipId`, `DailySchedule.planId`, `EducationCostPlan.countryId`, `AIUsageLog.conversationId`.
- **Missing indexes:** `Scholarship` has no index at all (filtered by country/category/verificationStatus); saved-item children lack FK indexes. Several redundant unique+index pairs.
- **No `Program` entity** — programs live as JSON strings on `Campus.programs` and `Course.department` without an FK to the `Department` model.
- **`FraudRule` model defined but never seeded** though the admin service manages it.
- **Seed pipeline not safe to compose:** `seed-fraud.ts`, `seed-countries.ts`, `seed-pakistan-comprehensive.ts` do destructive `deleteMany` + `create`; `seed-pakistan.ts` (fixed `uni-pk-001…`) vs `seed-pakistan-comprehensive.ts` (generated IDs from a different ordering) reassign the same IDs to different universities. Only `seed.ts` is wired to `db:seed`; `seed-admin.ts` originally hardcoded `admin@eduguard.com`/a fixed password — since fixed to read `ADMIN_SEED_PASSWORD` from env (no commit).

---

## 6. Infrastructure / Config Findings

- **`next.config.js` + `next.config.mjs` both exist — only `.js` is loaded** (Next resolves `.js` first). All `.mjs` settings (image remotePatterns, serverComponentsExternalPackages) are dead config.
- **`middleware.ts` token check is cosmetic** — verifies only that a `Bearer …` header *exists*, never the token. Load-bearing enforcement is per-route (which does exist), but the edge gate gives false assurance for any future route that forgets `requireAuth`.
- **CORS `Access-Control-Allow-Credentials: true`** despite a localStorage token flow; default `http://localhost:3000` origin fallback in production.
- **`audit.ts`** at root is a data-dump script (prints universities), not a security audit; not in package.json scripts.
- **`docker-compose.yml`** defaults: `POSTGRES_PASSWORD: eduguard_secret`, user `eduguard` — weak defaults.
- **`.eslintrc.json`** has no security rules (no `no-secrets`, no `react/no-danger`).

---

## 7. Test Suite Assessment

- **Good real-logic tests:** rule-engine, url-analyzer, password, jwt, rate-limit, ssrf-protection, credential-redaction, file-validation, fraud-security, voice-service.
- **Fake/tautological tests:** `auth-security.test.ts` (recomputes inline regex on literals, never calls app code), `api/auth.test.ts` (asserts properties of locally-constructed literals), `phase7-integration.test.ts` (re-implements arithmetic instead of importing code).
- **The only DB test (`seed-data.test.ts`) is broken-by-default** — requires ≥58 countries/≥51 scholarships that only the manually-run seed gauntlet produces (`db:seed` alone gives 8 countries / 10 scholarships).
- `src/tests/integration/` is empty. No skipped tests.

---

## 8. Documentation Claims vs Reality

| Doc claim | Reality |
|---|---|
| "77 models" / "56 models" (docs disagree with each other) | 89 models |
| "154 API routes" | ~174 route files |
| "1010 passing tests" / "850" (docs disagree) | 54+ test files, several are no-op tests; 1 DB test can't pass via `db:seed` alone |
| "56 models, 662 test cases" (ARCHITECTURE inner text) | stale |
| Stroke of good: docs honestly list planned-but-missing items (CSRF, account lockout, email verification) in "Planned" | — |

---

## 9. Top 12 Recommendations (priority order)

1. **Fix XSS** — sanitize AI output in `ChatMessage.tsx` (DOMPurify or render markdown to React elements); never `dangerouslySetInnerHTML` LLM output.
2. **Remove/ignore `.env.production`** (live OIDC JWT) and gitignore all non-local env files.
3. **Move refresh token to httpOnly cookie**; keep access token short-lived in memory.
4. **Fix broken fetches** — add Authorization headers / switch `teacher/*`, `education/plan`, `student` to `apiClient`.
5. **Delete/merge duplicate next configs**; migrate all routes that still use sync `params` to `Promise<params>` for Next 15 readiness.
6. **Wire SSRF protection end-to-end** — DNS resolution + per-redirect validation + IP-encoding detection in `url-analyzer`/`sources`; add CSP + COOP/CORP headers.
7. **Wire the defined rate limits** (`AI`, `OUTBOUND`, `GLOBAL`) into the expensive endpoints; rate-limit `/api/auth/refresh` + uploads; cap the in-memory map.
8. **Route the student-assistant context through the privacy filter**; add ownership checks to `DocumentService.updateStatus` and `financial-education` auto-populate.
9. **Fix verified bugs:** streaming finish_reason, `education-planner` AND-merge, fabricated p95/p99, source duration log, model default mismatch, module-load crash on scam-types typo.
10. **Delete dead code:** archived `EducationService`, unused `calculateRiskScore`, `lib/api-validation.ts` (or wire it as THE standard), unused UI primitives, empty component dirs.
11. **Reconcile the data layer:** pick one country model, add `@relation`s for the orphan FKs, index `Scholarship`, convert hot status/role columns to enums, add real seed workflow (idempotent, `db:seed`-complete, no ID collisions, no hardcoded creds).
12. **Consolidate frontend claims vs docs & tests:** fix no-op tests, make `seed-data.test.ts` pass from a single seed command, and update the architecture doc's model/route/test numbers.

---

## 10. Verdict

A genuinely feature-rich and well-intentioned education + anti-fraud platform with strong domain coverage, good defense-in-depth on auth, disciplined service singletons, and a thoughtful AI-fallback architecture. The dominant risks are (1) one real XSS-to-session-theft vector, (2) several silently broken frontend features, (3) SSRF/authz edge cases, (4) hardcoded data at scale, and (5) a seed/test pipeline that can't reproduce its own claimed state. None of these block the product; all should be addressed before production or judging demos.
# Deploying EduGuard AI to Vercel — Checklist

## Before pushing to the repo (done ✅)
- [x] Removed `next.config.js` / `next.config.mjs` duplication — single `.mjs` with Prisma external packages + image domains (Vercel-safe: standalone only for Docker)
- [x] `.env.production` (contained a live Vercel OIDC token) & all env files added to `.gitignore`
- [x] Removed hardcoded admin password from `prisma/seed-admin.ts` (reads `ADMIN_SEED_PASSWORD`)
- [x] Added `vercel-build` script (`prisma generate && next build`)
- [x] `.env.example` placeholders made clearly non-production

## 1. Database (required)
EduGuard uses **PostgreSQL**. Create a free one at https://neon.tech (or Supabase).
```bash
# Get the connection string from Neon, then set in Vercel:
DATABASE_URL="postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/eduguard_ai?sslmode=require"
```
After connecting, run these in your local terminal (command line) pointing at the same DB:
```bash
npx prisma db push        # create the tables
npm run db:seed           # base seed
npx tsx prisma/seed-pakistan-comprehensive.ts   # Pakistan universities (recommended)
npx tsx prisma/seed-scholarships.ts             # scholarships (recommended)
npx tsx prisma/seed-schemes.ts                  # government schemes (optional)
npx tsx prisma/seed-fraud.ts                    # cyber authorities (optional)
npx tsx prisma/seed-admin.ts                    # admin login (optional)
```

## 2. Environment variables in Vercel (Project → Settings → Environment Variables)

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | ✅ | Your Neon Postgres URL |
| `GROQ_API_KEY` | ✅ | From https://console.groq.com (code throws if empty) |
| `JWT_SECRET` | ✅ | Random ≥32 chars (e.g. `openssl rand -base64 32`) |
| `JWT_REFRESH_SECRET` | ✅ | Random ≥32 chars, different from JWT_SECRET |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your Vercel domain, e.g. `https://eduguard-ai.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | ✅ | Same as NEXT_PUBLIC_APP_URL |
| `JWT_EXPIRES_IN` | optional | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | optional | `7d` |
| `GEMINI_API_KEY` | optional | AI fallback #1 |
| `OPENROUTER_API_KEY` | optional | AI fallback #2 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | optional | Email (Ethereal test in dev) |
| `ADMIN_SEED_PASSWORD` | optional | Password for the admin seed script |

## 3. Imp commands
```bash
vercel login
vercel link          # in project root
vercel env add DATABASE_URL production   # paste value
vercel --prod        # deploy
```
Or simply push to GitHub → Import project on vercel.new → it auto-detects Next.js.

## 4. Known things to expect after deploy
- Login/register pages require the JWT secrets set (NODE_ENV=production enforces ≥32 chars).
- `GROQ_API_KEY` must be set or **every page that imports env.ts fails to boot**.
- Rate limiting is in-memory → per-serverless-instance (throttle numbers multiply).
- Password-reset emails only work once SMTP is configured (dev uses Etheral).
- The dev DB (`dev.db`) is gitignored — DB state lives in your Neon database only.

## 5. Troubleshooting
- **Build error "Cannot find module '@prisma/client'":** run `npx prisma generate` locally, commit fresh lockfile.
- **Middleware / edge runtime import errors:** this repo's middleware only uses edge-safe code (verified).
- **401 on /api/fraud/authorities:** the route requires auth by design (public listing is via pages).
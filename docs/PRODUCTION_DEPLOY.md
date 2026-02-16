# Streb Production Deployment Guide

This guide is aligned to the current codebase (env var names, webhook paths, and workflow files).

## Pre-Deployment

### 1. Verify Local Build
```bash
npm run build
npx tsc --noEmit
npm run lint
```

### 2. Run SQL Migrations (Supabase)
Login to Supabase -> SQL Editor -> Run your migrations.

Minimum required checks:
```sql
-- Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify required autopilot timestamp columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'autopilot_configs'
  AND column_name IN ('last_post_at', 'last_video_at', 'last_outreach_at');
```

You must also ensure `outreach_leads` exists (schema + indexes + uniques) because:
- `/api/autopilot/actions/outreach` inserts rows into `outreach_leads`
- `/api/webhooks/resend` updates `outreach_leads` statuses
- `/unsubscribe` updates `outreach_leads` statuses

### 3. Confirm n8n Workflows Are in Repo
Simplified workflows (these are the ones used by cron -> n8n -> action routes):
- `n8n-workflows/streb-autopilot-posting-simplified.json`
- `n8n-workflows/streb-autopilot-video-simplified.json`
- `n8n-workflows/streb-autopilot-outreach-simplified.json`

## Vercel Deployment (Next.js App)

### 1. Connect Repository
1. Go to Vercel
2. New Project -> Import from Git
3. Select the `streb` repository

### 2. Configure Environment Variables (Vercel -> Settings -> Environment Variables)
Add these in Vercel Production.

Core:
- `NEXT_PUBLIC_APP_URL` (example: `https://streb.vercel.app`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Cron + n8n:
- `CRON_SECRET` (used by `GET /api/autopilot/cron`)
- `N8N_WEBHOOK_URL` (base URL, example: `https://YOUR-N8N.up.railway.app`)
- `N8N_WEBHOOK_SECRET` (used by action routes and internal lead discovery wrapper calls)

AI:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Billing (Stripe):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Price IDs (supported by code in `lib/stripe.ts`):
  - `STRIPE_STARTER_MONTHLY_PRICE_ID` (or legacy `STRIPE_STARTER_PRICE_ID`)
  - `STRIPE_STARTER_ANNUAL_PRICE_ID` (optional but recommended)
  - `STRIPE_PRO_MONTHLY_PRICE_ID` (or legacy `STRIPE_PRO_PRICE_ID`)
  - `STRIPE_PRO_ANNUAL_PRICE_ID` (optional but recommended)
  - `STRIPE_AGENCY_MONTHLY_PRICE_ID` (or legacy `STRIPE_AGENCY_PRICE_ID`)
  - `STRIPE_AGENCY_ANNUAL_PRICE_ID` (optional but recommended)

Outreach/Email:
- `APOLLO_API_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET` (Svix secret used by `/api/webhooks/resend`)
- Optional:
  - `OUTREACH_EMAIL_DELAY_MS` (defaults to 60000 inside outreach route if not set)

Security:
- `VERIFICATION_SECRET` (HMAC for sender verification tokens)
- `UNSUBSCRIBE_SECRET` (HMAC for unsubscribe tokens)

Social OAuth Providers (only required for platforms you want to support in prod):
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `THREADS_CLIENT_ID`
- `THREADS_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `PRODUCT_HUNT_CLIENT_ID`
- `PRODUCT_HUNT_CLIENT_SECRET`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`

### 3. Deploy
```bash
git push origin main
```
Vercel auto-deploys.

## Railway Deployment (n8n)

### 1. Create Project
1. Railway -> New Project
2. Deploy n8n (from your template/fork)

### 2. Configure n8n
Set standard n8n env vars (examples):
- `N8N_HOST=0.0.0.0`
- `N8N_PORT=5678`
- `N8N_PROTOCOL=https`
- `WEBHOOK_URL=https://YOUR-N8N.up.railway.app`
- `N8N_ENCRYPTION_KEY=...`

Recommended: set this too so you can reference it in workflow expressions:
- `N8N_WEBHOOK_SECRET` (same value as Vercel `N8N_WEBHOOK_SECRET`)

### 3. Import Workflows
In n8n UI:
1. Workflows -> Import from File
2. Import the 3 simplified workflows:
   - `streb-autopilot-posting-simplified.json`
   - `streb-autopilot-video-simplified.json`
   - `streb-autopilot-outreach-simplified.json`

### 4. Update Workflow Secrets
For each workflow, open the HTTP Request node and set header:
- `Authorization: Bearer <YOUR_N8N_WEBHOOK_SECRET>`

Recommended approach (if you configured the env var in Railway):
- `Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}`

Then Activate each workflow.

### 5. Test Webhooks
These endpoints are GET webhooks in n8n (cron hits them):
```bash
curl -X GET "https://YOUR-N8N.up.railway.app/webhook/autopilot/post?userId=TEST&campaignId=TEST"
curl -X GET "https://YOUR-N8N.up.railway.app/webhook/autopilot/video?userId=TEST&campaignId=TEST"
curl -X GET "https://YOUR-N8N.up.railway.app/webhook/autopilot/outreach?userId=TEST&campaignId=TEST"
```

## Stripe Configuration

### 1. Create Products + Prices
Create products/prices in Stripe:
- Starter monthly ($49), Starter annual ($470)
- Pro monthly ($99), Pro annual ($950)
- Agency monthly ($249), Agency annual ($2,390)

### 2. Set Price IDs in Vercel
Copy each `price_...` id into the matching Vercel env vars:
- `STRIPE_STARTER_MONTHLY_PRICE_ID`, `STRIPE_STARTER_ANNUAL_PRICE_ID`
- `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`
- `STRIPE_AGENCY_MONTHLY_PRICE_ID`, `STRIPE_AGENCY_ANNUAL_PRICE_ID`

Legacy fallback support exists:
- `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`

### 3. Configure Stripe Webhook
Stripe Dashboard -> Developers -> Webhooks:
- Endpoint: `https://YOUR_DOMAIN/api/webhooks/stripe`
- Copy signing secret into `STRIPE_WEBHOOK_SECRET`

## Resend Configuration

### 1. Verify Sending Domain
Resend Dashboard -> Domains:
- Add domain (SPF/DKIM/DMARC)
- Wait for verification

### 2. Configure Resend Webhook
Resend Dashboard -> Webhooks:
- URL: `https://YOUR_DOMAIN/api/webhooks/resend`
- Events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.unsubscribed`
- Copy secret into `RESEND_WEBHOOK_SECRET`

## GitHub Actions Cron

### 1. Add Repository Secrets
GitHub -> Settings -> Secrets and variables -> Actions:
- `CRON_SECRET` (must match Vercel `CRON_SECRET`)
- `STREB_API_URL` (example: `https://streb.vercel.app`)

### 2. Confirm Workflow Exists
- `.github/workflows/autopilot-cron.yml` runs hourly at `0 * * * *`

### 3. Manual Test
GitHub Actions -> AutoPilot Cron -> Run workflow.

## OAuth App Configuration (Callback URLs)

All providers use the same base:
- `NEXT_PUBLIC_APP_URL` + `/api/oauth/<provider>/callback`

Configured callback routes in this repo:
- Twitter: `/api/oauth/twitter/callback`
- LinkedIn: `/api/oauth/linkedin/callback`
- TikTok: `/api/oauth/tiktok/callback`
- YouTube: `/api/oauth/youtube/callback`
- Reddit: `/api/oauth/reddit/callback`
- Threads: `/api/oauth/threads/callback`
- GitHub: `/api/oauth/github/callback`
- Product Hunt: `/api/oauth/product-hunt/callback`
- Facebook: `/api/oauth/facebook/callback`
- Instagram: `/api/oauth/instagram/callback`
- Meta: `/api/oauth/meta/callback`

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://YOUR_DOMAIN/api/health
```
Expect `status: "ok"` or investigate `services` in the JSON.

### 2. Manual Cron Trigger
Trigger from GitHub Actions (recommended), or curl directly:
```bash
curl -X GET "https://YOUR_DOMAIN/api/autopilot/cron" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. Smoke Test Signup + Onboarding
1. Visit your prod domain
2. Sign up
3. Complete onboarding and create a campaign
4. Confirm verification email arrives
5. Confirm dashboard shows the verification banner until verified

### 4. Monitor Logs
- Vercel -> Logs (API route errors/timeouts)
- n8n -> Executions (workflow failures)
- Supabase -> Logs (DB errors)

## Rollback Plan

If a critical issue is found:
1. Vercel -> Deployments -> Promote previous deployment
2. n8n -> Deactivate workflows
3. Fix locally and re-deploy after QA

## Monitoring

Daily:
- [ ] Cron execution success rate
- [ ] Function error rate < 1%
- [ ] Webhook delivery success
- [ ] Bounce/complaint rates within thresholds

Weekly:
- [ ] Cost tracking (APIs + infra)
- [ ] Deliverability metrics
- [ ] Conversion funnel sanity checks

DEPLOY WITH CONFIDENCE! 🚀


# Deployment Checklist

## 1. Platform Setup

- Vercel project connected to the correct GitHub repo/branch.
- Supabase project is production-grade and backups are enabled.
- Clerk app is in production mode with production domain.
- n8n instance is reachable from Vercel and webhooks are active.

## 2. Required Environment Variables

Set these in Vercel Production (not only local):

### Core
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Billing
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_MONTHLY_PRICE_ID` (or `STRIPE_STARTER_PRICE_ID`)
- `STRIPE_PRO_MONTHLY_PRICE_ID` (or `STRIPE_PRO_PRICE_ID`)
- `STRIPE_AGENCY_MONTHLY_PRICE_ID` (or `STRIPE_AGENCY_PRICE_ID`)

### AutoPilot
- `CRON_SECRET`
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`

### AI
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

### Social OAuth
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
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

### Optional / Feature-Specific
- `RESEND_API_KEY`
- `APOLLO_API_KEY`
- `TWITTER_BEARER_TOKEN`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `N8N_API_URL`
- `N8N_API_KEY`
- `REMOTION_BUNDLER_MODULE`
- `REMOTION_RENDERER_MODULE`
- `DATABASE_URL`

## 3. Database Readiness

- Run latest SQL migrations manually in Supabase SQL Editor.
- Confirm these tables exist:
- `users`
- `autopilot_configs`
- `autopilot_activity`
- `connected_accounts`
- `content_library`
- `analytics_events`
- `error_logs`
- Confirm table indexes exist for high-traffic queries.

## 4. Webhooks and Callbacks

- Clerk webhook endpoint set to `/api/webhooks/clerk`.
- Stripe webhook endpoint set to `/api/webhooks/stripe`.
- OAuth callback URLs configured for each provider against production domain.
- n8n workflows imported, active, and using correct `Authorization` header.

## 5. Preflight + Health Validation

- Run local preflight:
```bash
npx tsx scripts/preflight-check.ts
```
- Hit production health endpoint:
```bash
curl https://YOUR_DOMAIN/api/health
```
- Expect `status: "ok"` or review degraded service details before launch.

## 6. Smoke Tests (Production)

- Sign up a new user and confirm onboarding redirect.
- Connect at least one social account via OAuth.
- Create one campaign and activate AutoPilot.
- Trigger cron endpoint with `CRON_SECRET` and verify workflow dispatch.
- Confirm `autopilot_activity` entries are created.
- Confirm usage counters increment correctly.
- Confirm billing checkout + webhook updates plan limits.

## 7. Monitoring and Recovery

- Verify `/api/log-error` accepts and stores errors in `error_logs`.
- Set Vercel alerts for function errors and runtime failures.
- Keep a rollback strategy:
- redeploy previous stable commit
- keep old env values available
- disable cron temporarily if needed

## 8. Phase 4 Deprecations

- Legacy outreach endpoints are intentionally deprecated and now return `410 Gone`:
- `/api/outreach/search-twitter`
- `/api/outreach/search-linkedin`
- `/api/outreach/send`
- `/api/outreach/campaigns`
- Use `POST /api/autopilot/actions/outreach` for all outreach actions.
- Archived legacy workflow:
- `n8n-workflows/DEPRECATED_autopilot-outreach-workflow.json.bak`

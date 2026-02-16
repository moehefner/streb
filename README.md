# Streb

AutoPilot marketing platform for app founders.

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create your local env file:
```bash
cp .env.example .env.local
```

3. Run development server:
```bash
npm run dev
```

4. Build test:
```bash
npm run build
```

## Required Environment Variables

### Core
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### AutoPilot / Cron / n8n
- `CRON_SECRET`
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`
- `N8N_API_URL` (if using n8n API integration)
- `N8N_API_KEY` (if using n8n API integration)

### AI
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

### Billing
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_MONTHLY_PRICE_ID` (or `STRIPE_STARTER_PRICE_ID`)
- `STRIPE_PRO_MONTHLY_PRICE_ID` (or `STRIPE_PRO_PRICE_ID`)
- `STRIPE_AGENCY_MONTHLY_PRICE_ID` (or `STRIPE_AGENCY_PRICE_ID`)
- `STRIPE_STARTER_ANNUAL_PRICE_ID` (optional)
- `STRIPE_PRO_ANNUAL_PRICE_ID` (optional)
- `STRIPE_AGENCY_ANNUAL_PRICE_ID` (optional)

### OAuth Providers
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_BEARER_TOKEN` (only if using bearer-token based routes)
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

### Outreach / Email
- `RESEND_API_KEY`
- `APOLLO_API_KEY` (if Apollo lead sourcing is enabled)
- `OUTREACH_EMAIL_DELAY_MS` (optional)
- `OUTREACH_SEND_INTERVAL_MS` (optional)

### Remotion / Rendering
- `REMOTION_BUNDLER_MODULE` (optional override)
- `REMOTION_RENDERER_MODULE` (optional override)

### Database / Prisma
- `DATABASE_URL`

## Preflight Check (Before Deploy)

Run:
```bash
npx tsx scripts/preflight-check.ts
```

This validates:
- core env vars
- Supabase connectivity
- key DB tables (`users`, `autopilot_configs`)
- Stripe pricing IDs

## Health Endpoint

- `GET /api/health`
- Returns service status for:
  - database
  - stripe
  - ai configuration

## Deployment Checklist

Use `docs/DEPLOYMENT.md` before production deployment.

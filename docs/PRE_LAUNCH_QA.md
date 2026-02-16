# Streb Pre-Launch QA Checklist

## Environment Setup
- [ ] All env vars set in Vercel
- [ ] All env vars set in Railway (n8n)
- [ ] Supabase tables exist (run migrations)
- [ ] n8n workflows imported and active
- [ ] Resend webhook configured
- [ ] Stripe products created
- [ ] Stripe webhook configured

## Database Verification
- [ ] autopilot_configs.last_post_at column exists
- [ ] autopilot_configs.last_video_at column exists
- [ ] autopilot_configs.last_outreach_at column exists
- [ ] autopilot_configs.outreach_sender_email column exists
- [ ] autopilot_configs.outreach_sender_verified column exists
- [ ] outreach_leads table exists with all columns
- [ ] outreach_leads unique constraints exist
- [ ] outreach_leads indexes exist

## Auth & Onboarding
- [ ] Sign up works
- [ ] Screen 1: Connect at least 1 platform
- [ ] Screen 2: Fill required fields
- [ ] Screen 3: Sample preview generates
- [ ] Screen 4: Sender email required
- [ ] Screen 4: Keywords textarea works
- [ ] Screen 5: Frequencies selectable
- [ ] Submit creates campaign
- [ ] Verification email sent
- [ ] Redirect to dashboard works

## Sender Verification
- [ ] Verification email received
- [ ] Click link redirects to dashboard
- [ ] ?verify=success toast shows
- [ ] Banner disappears
- [ ] outreach_sender_verified = true in DB
- [ ] Resend button works
- [ ] Resend rate limited to 3/hour
- [ ] Forged token rejected
- [ ] Expired token rejected

## Cron Execution
- [ ] Trigger cron manually via GitHub Actions
- [ ] Cron finds active campaigns
- [ ] isDueForAction logic correct
- [ ] n8n receives userId + campaignId
- [ ] Post action triggered when due
- [ ] Video action triggered when due
- [ ] Outreach action triggered when due
- [ ] last_*_at timestamps updated

## Posting
- [ ] Twitter post works
- [ ] LinkedIn post works
- [ ] Facebook post works
- [ ] Instagram post works
- [ ] Image generation works (if enabled)
- [ ] posts_used increments by 1
- [ ] Activity logged with campaign_id
- [ ] Unsupported platforms return not_implemented

## Video
- [ ] Script generation works
- [ ] Remotion render works
- [ ] Twitter video upload (chunked) works
- [ ] Instagram Reel works
- [ ] Facebook video works
- [ ] TikTok video works
- [ ] YouTube Short works
- [ ] videos_used increments by 1
- [ ] Activity logged with campaign_id

## Outreach
- [ ] Sender unverified blocks sends (reason: unverified_sender)
- [ ] Monthly limit reached returns skipAction (reason: monthly_limit_reached)
- [ ] Dynamic pacing calculates correctly
- [ ] Apollo finds leads
- [ ] Email generation works
- [ ] Unsubscribe link added to footer
- [ ] Resend sends email
- [ ] outreach_leads row inserted
- [ ] emails_used increments only on success
- [ ] Suppression check blocks bounced/unsubscribed
- [ ] Already-contacted check blocks duplicates
- [ ] Activity logged with campaign_id

## Resend Webhooks
- [ ] email.delivered updates status
- [ ] email.opened updates status + timestamp
- [ ] email.clicked updates status + timestamp
- [ ] email.bounced updates status + timestamp
- [ ] email.complained marks unsubscribed
- [ ] Bounce rate >10% auto-pauses campaign
- [ ] Complaint rate >0.1% auto-pauses campaign
- [ ] Pause logged to autopilot_activity

## Unsubscribe
- [ ] Unsubscribe link opens page
- [ ] Token verified
- [ ] Status updates to unsubscribed
- [ ] Future sends blocked
- [ ] Forged token rejected
- [ ] Expired token rejected (>30 days)

## Billing
- [ ] Checkout creates session
- [ ] Stripe redirects back
- [ ] Webhook updates plan
- [ ] Limits sync correctly
- [ ] Usage counters work
- [ ] Upgrade flow works
- [ ] Customer portal works

## Dashboard
- [ ] Campaign stats show
- [ ] Activity feed works
- [ ] Usage cards accurate
- [ ] Verification banner shows when needed
- [ ] Upgrade prompts appear at 80%
- [ ] Hard limit blocks execution

## Multi-Campaign
- [ ] Create 2nd campaign works
- [ ] Switch between campaigns
- [ ] Each has own activity
- [ ] Usage shared account-wide
- [ ] Campaign limit enforced

## Edge Cases
- [ ] Campaign paused skips execution
- [ ] Campaign inactive skips execution
- [ ] Missing sender email blocks outreach
- [ ] No platforms selected skips post/video
- [ ] Invalid credentials handled gracefully
- [ ] Rate limits respected
- [ ] Timeouts handled

## Performance
- [ ] Cron completes <30s
- [ ] Post action <10s
- [ ] Video action <180s
- [ ] Outreach action <60s
- [ ] Dashboard loads <2s
- [ ] No memory leaks

## Security
- [ ] All tokens HMAC-signed
- [ ] Webhook auth verified
- [ ] User data isolated
- [ ] No sensitive data in logs
- [ ] CORS configured
- [ ] Rate limits enforced

RUN THIS CHECKLIST TOP TO BOTTOM BEFORE LAUNCH


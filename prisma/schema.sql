-- ============================================
-- STREB DATABASE SCHEMA
-- ============================================
-- Marketing automation platform for SaaS builders
-- PostgreSQL schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL, -- Clerk auth ID
  email TEXT NOT NULL,
  full_name TEXT,
  
  -- Subscription
  plan_type TEXT DEFAULT 'free', -- 'free', 'starter', 'pro', 'agency'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT, -- 'active', 'canceled', 'past_due'
  subscription_current_period_end TIMESTAMP,
  
  -- Usage tracking (resets monthly)
  posts_used INT DEFAULT 0,
  videos_used INT DEFAULT 0,
  emails_used INT DEFAULT 0,
  
  -- Usage limits (based on plan)
  posts_limit INT DEFAULT 5, -- free: 5, starter: 100, pro: 250, agency: 500
  videos_limit INT DEFAULT 3, -- free: 3, starter: 25, pro: 75, agency: 150
  emails_limit INT DEFAULT 25, -- free: 25, starter: 750, pro: 2000, agency: 5000
  
  -- App details (for AutoPilot)
  app_name TEXT,
  app_description TEXT,
  app_url TEXT,
  target_audience TEXT,
  ideal_customer TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CONNECTED ACCOUNTS TABLE
-- ============================================
CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  platform TEXT NOT NULL, -- 'twitter', 'reddit', 'product_hunt', 'linkedin', etc.
  account_username TEXT, -- @username on platform
  
  -- OAuth tokens (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  
  UNIQUE(user_id, platform)
);

-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Post content
  post_type TEXT NOT NULL, -- 'text', 'image_text', 'video'
  content_text TEXT, -- Caption/text content
  image_url TEXT, -- DALL-E generated image (if image post)
  video_id UUID REFERENCES videos(id), -- If posting a video
  
  -- Platform-specific content
  platform_captions JSONB, -- { "twitter": "tweet text", "linkedin": "linkedin text" }
  
  -- Posting info
  platforms TEXT[], -- ['twitter', 'reddit', 'linkedin']
  posted_at TIMESTAMP,
  scheduled_for TIMESTAMP, -- If scheduled
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'posted', 'failed'
  
  -- Results
  engagement JSONB, -- { "twitter": { "likes": 45, "retweets": 12 } }
  
  -- Metadata
  is_autopilot BOOLEAN DEFAULT false, -- Created by AutoPilot or manual
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VIDEOS TABLE
-- ============================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Video details
  video_type TEXT NOT NULL, -- 'demo', 'feature', 'tutorial', 'ad', 'testimonial'
  title TEXT,
  description TEXT,
  
  -- Video generation
  input_source TEXT, -- 'github', 'url', 'manual', 'screenshots'
  input_data JSONB, -- { "github_repo": "...", "url": "...", "screenshots": [...] }
  script JSONB, -- Claude-generated video script
  
  -- Remotion rendering
  video_url TEXT, -- Supabase Storage URL
  thumbnail_url TEXT,
  duration INT, -- seconds
  resolution TEXT, -- '1080p', '720p'
  
  -- Status
  status TEXT DEFAULT 'generating', -- 'generating', 'ready', 'failed'
  render_started_at TIMESTAMP,
  render_completed_at TIMESTAMP,
  
  -- Usage
  has_watermark BOOLEAN DEFAULT false, -- true for free tier
  posted BOOLEAN DEFAULT false, -- Has this video been posted?
  
  -- Metadata
  is_autopilot BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- OUTREACH CAMPAIGNS TABLE
-- ============================================
CREATE TABLE outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL, -- "TaskMaster Launch Campaign"
  ideal_customer TEXT, -- "SaaS founders using Stripe"
  
  -- Settings
  max_emails_per_day INT DEFAULT 25,
  follow_up_enabled BOOLEAN DEFAULT true,
  follow_up_delay_days INT DEFAULT 3,
  auto_respond_enabled BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
  
  -- Stats
  leads_found INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_replied INT DEFAULT 0,
  
  -- Metadata
  is_autopilot BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  paused_at TIMESTAMP
);

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  
  -- Lead info
  email TEXT NOT NULL,
  full_name TEXT,
  twitter_handle TEXT,
  linkedin_url TEXT,
  
  -- Context (for personalization)
  recent_activity JSONB, -- Recent tweets, LinkedIn posts
  pain_points TEXT, -- AI-extracted pain points
  
  -- Email status
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,
  email_opened BOOLEAN DEFAULT false,
  email_clicked BOOLEAN DEFAULT false,
  email_replied BOOLEAN DEFAULT false,
  
  -- Follow-up
  follow_up_sent BOOLEAN DEFAULT false,
  follow_up_sent_at TIMESTAMP,
  
  -- Reply
  reply_text TEXT,
  reply_received_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- USAGE STATS TABLE (for analytics)
-- ============================================
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Period
  month TEXT NOT NULL, -- '2026-02'
  
  -- Usage
  posts_used INT DEFAULT 0,
  videos_used INT DEFAULT 0,
  emails_used INT DEFAULT 0,
  
  -- Results
  total_engagement INT DEFAULT 0, -- likes + comments + shares
  total_video_views INT DEFAULT 0,
  total_email_opens INT DEFAULT 0,
  total_signups INT DEFAULT 0, -- If user tracks this
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, month)
);

-- ============================================
-- AUTOPILOT CONFIG TABLE
-- ============================================
CREATE TABLE autopilot_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- AutoPilot status
  is_active BOOLEAN DEFAULT false,
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  
  -- Content mix (for posts)
  text_post_percentage INT DEFAULT 65, -- 65% text posts
  image_post_percentage INT DEFAULT 35, -- 35% image posts
  
  -- Video settings
  video_frequency INT DEFAULT 3, -- videos per week
  video_types TEXT[], -- ['demo', 'feature', 'tutorial']
  
  -- Outreach settings
  outreach_enabled BOOLEAN DEFAULT true,
  max_emails_per_day INT DEFAULT 25,
  
  -- Platforms
  post_platforms TEXT[], -- ['twitter', 'linkedin', 'reddit']
  video_platforms TEXT[], -- ['tiktok', 'youtube', 'instagram']
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TEAM MEMBERS TABLE (for Agency plan)
-- ============================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  member_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  
  -- Permissions
  can_create_posts BOOLEAN DEFAULT true,
  can_create_videos BOOLEAN DEFAULT true,
  can_manage_outreach BOOLEAN DEFAULT true,
  can_manage_team BOOLEAN DEFAULT false,
  
  invited_at TIMESTAMP DEFAULT NOW(),
  joined_at TIMESTAMP,
  
  UNIQUE(team_owner_id, member_user_id)
);

-- ============================================
-- CLIENTS TABLE (for Agency plan)
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  client_name TEXT NOT NULL,
  client_email TEXT,
  
  -- Client's app
  app_name TEXT,
  app_description TEXT,
  app_url TEXT,
  
  -- Assigned team member
  assigned_to_user_id UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan ON users(plan_type);

CREATE INDEX idx_connected_accounts_user ON connected_accounts(user_id);
CREATE INDEX idx_connected_accounts_platform ON connected_accounts(platform);

CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_for);

CREATE INDEX idx_videos_user ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);

CREATE INDEX idx_campaigns_user ON outreach_campaigns(user_id);
CREATE INDEX idx_campaigns_status ON outreach_campaigns(status);

CREATE INDEX idx_leads_campaign ON leads(campaign_id);
CREATE INDEX idx_leads_email ON leads(email);

CREATE INDEX idx_usage_stats_user_month ON usage_stats(user_id, month);

CREATE INDEX idx_autopilot_user ON autopilot_config(user_id);

CREATE INDEX idx_team_members_owner ON team_members(team_owner_id);
CREATE INDEX idx_team_members_member ON team_members(member_user_id);

CREATE INDEX idx_clients_agency ON clients(agency_user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = clerk_user_id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = clerk_user_id);

-- Connected accounts policies
CREATE POLICY "Users can view own connected accounts" ON connected_accounts
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can manage own connected accounts" ON connected_accounts
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Posts policies
CREATE POLICY "Users can view own posts" ON posts
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can manage own posts" ON posts
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Videos policies
CREATE POLICY "Users can view own videos" ON videos
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can manage own videos" ON videos
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Campaigns policies
CREATE POLICY "Users can view own campaigns" ON outreach_campaigns
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can manage own campaigns" ON outreach_campaigns
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Leads policies (through campaigns)
CREATE POLICY "Users can view own leads" ON leads
  FOR SELECT USING (campaign_id IN (
    SELECT id FROM outreach_campaigns WHERE user_id IN (
      SELECT id FROM users WHERE clerk_user_id = auth.uid()::text
    )
  ));

CREATE POLICY "Users can manage own leads" ON leads
  FOR ALL USING (campaign_id IN (
    SELECT id FROM outreach_campaigns WHERE user_id IN (
      SELECT id FROM users WHERE clerk_user_id = auth.uid()::text
    )
  ));

-- Usage stats policies
CREATE POLICY "Users can view own usage stats" ON usage_stats
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Autopilot config policies
CREATE POLICY "Users can view own autopilot config" ON autopilot_config
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can manage own autopilot config" ON autopilot_config
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Team members policies
CREATE POLICY "Team owners can view team members" ON team_members
  FOR SELECT USING (team_owner_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Team owners can manage team members" ON team_members
  FOR ALL USING (team_owner_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- Clients policies
CREATE POLICY "Agency users can view own clients" ON clients
  FOR SELECT USING (agency_user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Agency users can manage own clients" ON clients
  FOR ALL USING (agency_user_id IN (SELECT id FROM users WHERE clerk_user_id = auth.uid()::text));

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for autopilot_config table
CREATE TRIGGER update_autopilot_config_updated_at BEFORE UPDATE ON autopilot_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id UUID,
  p_usage_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_used INT;
  v_limit INT;
BEGIN
  IF p_usage_type = 'posts' THEN
    SELECT posts_used, posts_limit INTO v_used, v_limit FROM users WHERE id = p_user_id;
  ELSIF p_usage_type = 'videos' THEN
    SELECT videos_used, videos_limit INTO v_used, v_limit FROM users WHERE id = p_user_id;
  ELSIF p_usage_type = 'emails' THEN
    SELECT emails_used, emails_limit INTO v_used, v_limit FROM users WHERE id = p_user_id;
  END IF;
  
  RETURN v_used < v_limit;
END;
$$ LANGUAGE plpgsql;

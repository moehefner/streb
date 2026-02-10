-- Add platform_user_id column to connected_accounts table if it doesn't exist
-- This migration adds the missing platform_user_id field for storing Twitter user IDs

ALTER TABLE connected_accounts
ADD COLUMN IF NOT EXISTS platform_user_id TEXT;

-- Add index for faster lookups by platform_user_id
CREATE INDEX IF NOT EXISTS idx_connected_accounts_platform_user_id 
ON connected_accounts(platform_user_id);

-- Run this in Supabase SQL Editor to add autopilot_active to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS autopilot_active BOOLEAN DEFAULT false;

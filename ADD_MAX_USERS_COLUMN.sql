-- Add max_users column to organizations table for user limit enforcement
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT NULL;

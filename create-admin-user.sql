-- ============================================================================
-- BioBridge Pro ERP - Create Admin User
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: First, create the user in Supabase Auth UI:
-- Go to: https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/auth/users
-- Click "Add user"
-- Email: admin@biobridge.com
-- Password: Admin@12345
-- ✓ Check "Auto Confirm User"
-- Click "Create user"
-- Copy the User ID (UUID) shown

-- Step 2: Replace <USER_ID_FROM_AUTH> below with the UUID you copied
-- Then run this entire script

-- Create admin user profile
INSERT INTO users (
  auth_id,
  username,
  email,
  full_name,
  role,
  organization_id,
  branch_id,
  is_active,
  must_change_password,
  created_at,
  updated_at
) 
SELECT 
  '<USER_ID_FROM_AUTH>'::uuid,  -- ← REPLACE THIS with actual Auth User ID
  'admin',
  'admin@biobridge.com',
  'System Administrator',
  'SUPER_ADMIN',
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM branches LIMIT 1),
  true,
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@biobridge.com'
);

-- Verify the user was created
SELECT 
  id,
  username,
  email,
  role,
  is_active,
  created_at
FROM users 
WHERE email = 'admin@biobridge.com';

-- ============================================================================
-- SUCCESS! Now you can login with:
-- Email: admin@biobridge.com
-- Password: Admin@12345
-- ============================================================================

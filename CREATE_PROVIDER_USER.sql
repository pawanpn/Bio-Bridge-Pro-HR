-- ============================================================================
-- CREATE PROVIDER USER - Run this in Supabase SQL Editor
-- ============================================================================
-- Step 1: First create the auth user in Supabase Dashboard:
--         Authentication > Users > Add User
--         Email: provider@biobridge.com
--         Password: Provider@2026!
--         (Or any password you want)
--
-- Step 2: Then run this SQL to link the auth user to the provider role
-- ============================================================================

-- Link the provider auth user to public.users with PROVIDER role
INSERT INTO public.users (auth_id, username, email, full_name, role, is_active, must_change_password)
SELECT 
    u.id,
    'provider',
    'provider@biobridge.com',
    'System Provider',
    'PROVIDER',
    TRUE,
    FALSE
FROM auth.users u
WHERE u.email = 'provider@biobridge.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.email = 'provider@biobridge.com'
  );

-- Verify the user was created
SELECT id, username, email, role, is_active, created_at 
FROM public.users 
WHERE role = 'PROVIDER';

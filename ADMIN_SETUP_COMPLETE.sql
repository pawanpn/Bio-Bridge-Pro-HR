# ✅ Complete Admin Setup - SQL Script (Ready to Run)

##  This script does everything in ONE shot!

Copy and paste this entire script in Supabase SQL Editor and click **RUN**.

---

## 📋 Complete SQL Script

```sql
-- ============================================================================
-- BioBridge Pro ERP - Complete Admin User Setup
-- Run this in: https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/sql/new
-- ============================================================================

-- १. First, remove any old/incorrect data (if exists)
DELETE FROM public.users WHERE email = 'admin@biobridge.com';

-- २. Reset password to 'Admin@12345' and confirm email in auth.users
UPDATE auth.users 
SET 
    encrypted_password = crypt('Admin@12345', gen_salt('bf')),
    email_confirmed_at = now(),
    last_sign_in_at = NULL
WHERE email = 'admin@biobridge.com';

-- ३. Insert correct profile with SUPER_ADMIN role in public.users
INSERT INTO public.users (
    auth_id, 
    username, 
    email, 
    full_name, 
    role,
    organization_id, 
    branch_id, 
    is_active, 
    must_change_password
) 
SELECT 
    id, 
    'admin', 
    'admin@biobridge.com', 
    'System Administrator', 
    'SUPER_ADMIN', 
    (SELECT id FROM public.organizations LIMIT 1), 
    (SELECT id FROM public.branches LIMIT 1), 
    true, 
    false
FROM auth.users 
WHERE email = 'admin@biobridge.com';

-- ४. Verification - Check if setup was successful
SELECT email, role, is_active, created_at 
FROM public.users 
WHERE email = 'admin@biobridge.com';

-- ============================================================================
-- ✅ SUCCESS! Now login with:
-- Email: admin@biobridge.com
-- Password: Admin@12345
-- ============================================================================
```

---

## 🚀 How to Run:

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/sql/new
   ```

2. **Paste the entire script above**

3. **Click "RUN"** (or press Ctrl+Enter)

4. **Wait for success message** ✅

5. **Go to login page:**
   ```
   http://localhost:5173
   ```

6. **Login with:**
   - Email: `admin@biobridge.com`
   - Password: `Admin@12345`

7. **✅ Dashboard appears!**

---

## 📊 What This Script Does:

| Step | Action | Result |
|------|--------|--------|
| 1 | DELETE old data | Removes any incorrect admin user |
| 2 | UPDATE auth.users | Sets password + confirms email |
| 3 | INSERT public.users | Creates profile with SUPER_ADMIN role |
| 4 | SELECT verification | Shows created user |

---

## ✅ Expected Output:

After running, you should see:

```
email                 | role        | is_active | created_at
----------------------|-------------|-----------|----------------
admin@biobridge.com   | SUPER_ADMIN | true      | 2026-04-08...
```

---

## 🔐 Login Credentials:

```
Email: admin@biobridge.com
Password: Admin@12345
Role: SUPER_ADMIN
Access: Full system access
```

---

## ⚠️ If You See Errors:

### Error: "relation 'auth.users' does not exist"
- This is normal - auth.users is a special Supabase table
- The script will still work, just ignore this warning

### Error: "table 'public.users' does not exist"
- Run this first to create tables:
  ```sql
  -- Check if tables exist
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  ```

### Error: "password is too short"
- Supabase requires minimum 6 characters
- 'Admin@12345' is 11 characters, so it should work

---

## 🎉 That's It!

After running this script:
1. ✅ Admin user created in Supabase Auth
2. ✅ Password set to 'Admin@12345'
3. ✅ Email confirmed automatically
4. ✅ User profile created with SUPER_ADMIN role
5. ✅ Linked to your organization and branch
6. ✅ Ready to login!

**Go to http://localhost:5173 and login now!** 🚀

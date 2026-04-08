# 🚨 URGENT FIX: Create Admin User Manually

## ❌ Problem:
The user `admin@biobridge.com` **DOES NOT EXIST** in Supabase Auth. That's why you get "Invalid login credentials".

## ✅ Solution: Create User via Supabase Dashboard (Takes 1 minute)

---

### **STEP 1: Create User in Supabase Auth UI**

1. **Open this link:**
   ```
   https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/auth/users
   ```

2. **Click "Add user" button** (top right corner)

3. **Fill in the form:**
   ```
   Email: admin@biobridge.com
   Password: Admin@12345
   ```

4. **✅ CHECK "Auto Confirm User"** (THIS IS IMPORTANT!)

5. **Click "Create user"**

6. **You should see the user in the list now**

---

### **STEP 2: Create User Profile in Database**

1. **Open SQL Editor:**
   ```
   https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/sql/new
   ```

2. **Paste this SQL:**

```sql
-- Create admin user profile linked to auth user
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
    au.id::uuid, 
    'admin', 
    'admin@biobridge.com', 
    'System Administrator', 
    'SUPER_ADMIN', 
    (SELECT id FROM public.organizations LIMIT 1), 
    (SELECT id FROM public.branches LIMIT 1), 
    true, 
    false
FROM auth.users au
WHERE au.email = 'admin@biobridge.com'
AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = 'admin@biobridge.com'
);

-- Verify the user was created
SELECT 
    u.email, 
    u.role, 
    u.is_active,
    u.must_change_password,
    u.auth_id
FROM public.users u
WHERE u.email = 'admin@biobridge.com';
```

3. **Click "RUN"**

4. **You should see:**
   ```
   email                 | role        | is_active | must_change_password
   ----------------------|-------------|-----------|---------------------
   admin@biobridge.com   | SUPER_ADMIN | true      | false
   ```

---

### **STEP 3: Login**

1. **Go to:** http://localhost:5173

2. **Refresh the page** (Ctrl+R)

3. **Login with:**
   - **Email:** `admin@biobridge.com`
   - **Password:** `Admin@12345`

4. **Click "Sign In"**

5. **✅ Dashboard should appear!**

---

## ⚠️ IMPORTANT NOTES:

1. **Email must be EXACTLY:** `admin@biobridge.com` (lowercase)
2. **Password must be EXACTLY:** `Admin@12345` (case-sensitive)
3. **"Auto Confirm User" MUST BE CHECKED** when creating user
4. **If you see "Invalid login credentials" again**, it means the user still doesn't exist in Auth

---

## 🔍 Verification:

After creating the user, you can verify in Supabase:

1. Go to **Auth → Users**
2. You should see `admin@biobridge.com` listed
3. It should show as "Confirmed" (green checkmark)

---

##  Quick Summary:

| Step | Action | Time |
|------|--------|------|
| 1 | Create user in Auth UI | 30 seconds |
| 2 | Run SQL to create profile | 30 seconds |
| 3 | Login to app | 10 seconds |
| **Total** | | **~1 minute** |

---

**Once you complete these steps, login will work!** 🚀

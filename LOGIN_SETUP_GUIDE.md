# 🔐 BioBridge Pro ERP - Login Setup Guide

## ⚠️ Problem: Login भएन, Authentication छैन

**समाधान:** तलका steps follow गर्नुहोस् (2 मिनेट मात्र लाग्छ)

---

## 📋 Step-by-Step Instructions

### **Step 1: Supabase Auth मा User बनाउने** (1 मिनेट)

1. **यो link खोल्नुहोस्:**
   ```
   https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/auth/users
   ```

2. **"Add user" button मा click गर्नुहोस्** (माथि right side मा)

3. **Form fill गर्नुहोस्:**
   ```
   Email: admin@biobridge.com
   Password: Admin@12345
   ```

4. **✓ "Auto Confirm User" CHECKBOX CHECK गर्नुहोस्** (यो important छ!)

5. **"Create user" click गर्नुहोस्**

6. **User ID (UUID) copy गर्नुहोस्** 
   - यस्तो देखिन्छ: `123e4567-e89b-12d3-a456-426614174000`
   - यो copy गरेर राख्नुहोस्

---

### **Step 2: Users Table मा Profile बनाउने** (1 मिनेट)

1. **SQL Editor खोल्नुहोस्:**
   ```
   https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/sql/new
   ```

2. **यो SQL paste गर्नुहोस्:**

```sql
INSERT INTO users (
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
  'PASTE_YOUR_USER_ID_HERE'::uuid,  -- ← यहाँ माथिको UUID paste गर्नुहोस्
  'admin',
  'admin@biobridge.com',
  'System Administrator',
  'SUPER_ADMIN',
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM branches LIMIT 1),
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@biobridge.com'
);
```

3. **`'PASTE_YOUR_USER_ID_HERE'` लाई replace गर्नुहोस्** Step 1 मा copy गरेको UUID ले

4. **"Run" button click गर्नुहोस्**

5. **Success message आउनुपर्छ** ✅

---

### **Step 3: Login गर्ने** (30 सेकेन्ड)

1. **Application खोल्नुहोस्:**
   ```
   http://localhost:5173
   ```

2. **Login page मा:**
   ```
   Email: admin@biobridge.com
   Password: Admin@12345
   ```

3. **"Sign In" click गर्नुहोस्**

4. **✅ Dashboard मा पुग्नुपर्छ!**

---

## 🎯 Quick Reference

### Login Credentials:
```
Email: admin@biobridge.com
Password: Admin@12345
Role: SUPER_ADMIN (full access)
```

### Important Links:
- **Supabase Dashboard:** https://supabase.com/dashboard/project/silexuzptqjvzopuwzof
- **Auth Users:** https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/auth/users
- **SQL Editor:** https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/sql/new
- **Table Editor:** https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/editor

---

## ❓ Troubleshooting

### Login भएन भने:

**Problem:** "Invalid login credentials"
- **Solution:** Email र password check गर्नुहोस् (case-sensitive)

**Problem:** "User not found"
- **Solution:** Step 1 र Step 2 दुवै complete गर्नुहोस्

**Problem:** "Auto Confirm User" check गरेनौं
- **Solution:** 
  1. Auth users मा जानुहोस्
  2. User मा click गर्नुहोस्
  3. "Confirm signup" गर्नुहोस्

**Problem:** Tables छैनन्
- **Solution:** यो SQL run गर्नुहोस्:
  ```sql
  -- Check if tables exist
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  ```

---

## 🔒 Security Note

**पहिलो login पछि password change गर्नुहोस्!**

1. Dashboard मा गएपछि
2. Profile/Settings मा जानुहोस्
3. Password change गर्नुहोस्

---

## ✅ Verification

सबै ठीक छ कि check गर्न:

1. **Supabase Dashboard → Table Editor → users**
2. **तपाईंको admin user देखिनुपर्छ:**
   ```
   username: admin
   email: admin@biobridge.com
   role: SUPER_ADMIN
   is_active: true
   ```

3. **Supabase Auth → Users**
4. **admin@biobridge.com देखिनुपर्छ (confirmed)**

---

**🎉 That's it! Aba login हुनुपर्छ!**

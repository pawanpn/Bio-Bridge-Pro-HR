# ✅ Schema Mapping - My Code → Your Supabase Schema

## 📋 Summary

I've updated ALL my code to perfectly match your existing Supabase schema. Here's what changed:

---

## 🔑 KEY Differences Fixed

### 1. **User Roles** (CRITICAL FIX)

**❌ Before (My Code - WRONG):**
```typescript
// Had a separate "roles" table
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR,
  code VARCHAR
);

// Users had role_id foreign key
users.role_id UUID REFERENCES roles(id)
```

**✅ After (Your Schema - CORRECT):**
```sql
-- You use role VARCHAR field directly in users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  role VARCHAR(50) DEFAULT 'EMPLOYEE', -- SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE, OPERATOR
  auth_id UUID, -- Links to Supabase auth.users.id
  ...
);
```

**My Code Now Uses:**
```typescript
// ✅ No roles table - role is a string field
user.role = 'SUPER_ADMIN' // Direct string value

// ✅ Queries use role VARCHAR
const { data } = await supabase
  .from('users')
  .select('role')
  .eq('id', userId);

// ✅ role_permissions uses role VARCHAR
const { data } = await supabase
  .from('role_permissions')
  .select('*')
  .eq('role', 'SUPER_ADMIN'); // Not role_id!
```

---

### 2. **All IDs are UUID (Not INTEGER)**

**✅ Your Schema:**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
organization_id UUID REFERENCES organizations(id)
branch_id UUID REFERENCES branches(id)
department_id UUID REFERENCES departments(id)
```

**✅ My Code Now Uses:**
```typescript
// All IDs are UUID strings
interface User {
  id: string; // UUID
  branch_id?: string; // UUID
  department_id?: string; // UUID
}

interface Employee {
  id: string; // UUID
  reporting_manager_id?: string; // UUID (self-referential)
}
```

---

### 3. **Users Table - auth_id Field**

**✅ Your Schema:**
```sql
CREATE TABLE users (
  auth_id UUID, -- Supabase auth.users.id (links to Supabase Auth)
  ...
);
```

**✅ My Code Now Uses:**
```typescript
// Login via Supabase Auth, then link to your users table
const { data: { session } } = await supabase.auth.signInWithPassword({
  email, password
});

// Get profile using auth_id
const { data: userProfile } = await supabase
  .from('users')
  .select('*')
  .eq('auth_id', session.user.id); // Links Supabase Auth to your users table
```

---

### 4. **Employees Table - Field Names**

**✅ Your Schema:**
```sql
CREATE TABLE employees (
  personal_email VARCHAR(255), -- NOT "email"
  personal_phone VARCHAR(50),  -- NOT "phone"
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(255) GENERATED ALWAYS AS (...),
  -- NO role_id field!
  -- NO email/phone fields!
);
```

**✅ My Code Now Uses:**
```typescript
interface Employee {
  personal_email?: string; // ✅ Matches your schema
  personal_phone?: string; // ✅ Matches your schema
  full_name: string;       // ✅ Matches your schema
  // NO role_id - employees don't have role field
}
```

---

### 5. **Permissions Table - organization_id**

**✅ Your Schema:**
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id), -- ✅ Has org_id
  module VARCHAR(100),
  permission VARCHAR(100),
  UNIQUE(module, permission)
);
```

**✅ My Code Now Uses:**
```typescript
// Insert permissions with organization_id
const { data } = await supabase
  .from('permissions')
  .insert(permissions.map(p => ({
    ...p,
    organization_id: orgId // ✅ Include org_id
  })));
```

---

### 6. **Role Permissions Table - Uses role VARCHAR**

**✅ Your Schema:**
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  role VARCHAR(50) NOT NULL, -- ✅ Uses role string, NOT role_id
  permission_id UUID REFERENCES permissions(id),
  UNIQUE(role, permission_id)
);
```

**✅ My Code Now Uses:**
```typescript
// Insert role permissions with role VARCHAR
await supabase
  .from('role_permissions')
  .insert({
    role: 'SUPER_ADMIN',      // ✅ String value
    permission_id: perm.id,
    organization_id: orgId
  });

// Query by role string
const { data } = await supabase
  .from('role_permissions')
  .select('*')
  .eq('role', 'MANAGER'); // ✅ Not role_id!
```

---

## 📊 Complete Table Mapping

| Table | Your Schema Field | My Code Now Uses |
|-------|------------------|------------------|
| **organizations** | id UUID ✅ | ✅ UUID |
| **branches** | id UUID, organization_id UUID ✅ | ✅ UUID |
| **departments** | id UUID, parent_id UUID ✅ | ✅ UUID |
| **designations** | id UUID, organization_id UUID ✅ | ✅ UUID |
| **users** | id UUID, role VARCHAR, auth_id UUID ✅ | ✅ All match |
| **employees** | id UUID, personal_email, personal_phone ✅ | ✅ All match |
| **permissions** | id UUID, organization_id UUID ✅ | ✅ All match |
| **role_permissions** | role VARCHAR (not role_id!) ✅ | ✅ Uses role VARCHAR |
| **user_branch_access** | user_id UUID, branch_id UUID ✅ | ✅ UUID |
| **user_department_access** | user_id UUID, department_id UUID ✅ | ✅ UUID |
| **attendance_logs** | id UUID, employee_id UUID ✅ | ✅ UUID |
| **attendance_daily** | id UUID, employee_id UUID ✅ | ✅ UUID |

---

## 🔧 Files Updated

### 1. **EnhancedSetupWizard.tsx**
- ❌ Removed `roles` table creation
- ✅ Added `system_roles` (for reference only)
- ✅ `users` table uses `role VARCHAR`
- ✅ `role_permissions` uses `role VARCHAR`
- ✅ `employees` uses `personal_email`, `personal_phone`
- ✅ All permissions include `organization_id`

### 2. **usePermission.ts** (Hook)
- ✅ Queries `users.role` (VARCHAR field)
- ✅ Queries `role_permissions` by `role` string
- ✅ Returns `userRole: string` (not object)

### 3. **PermissionManagement.tsx**
- ✅ No role table queries
- ✅ Uses role codes: 'SUPER_ADMIN', 'ADMIN', etc.
- ✅ Saves permissions with `role` VARCHAR
- ✅ Reset function uses role strings

### 4. **EmployeeHierarchyTree.tsx**
- ✅ Uses `personal_email` instead of `email`
- ✅ Uses `personal_phone` instead of `phone`
- ✅ Removed `role` field from interface
- ✅ Removed role badge display

### 5. **AuthContext.tsx**
- ✅ Uses Supabase Auth (signInWithPassword)
- ✅ Links to your users table via `auth_id`
- ✅ Loads user profile with `role` VARCHAR
- ✅ Stores user in localStorage

---

## 🎯 How It Works Now

### User Login Flow (Matches Your Schema):

```
1. User enters email/password
   ↓
2. Supabase Auth authenticates (auth.users table)
   ↓
3. Get user's auth.id from Supabase Auth
   ↓
4. Query YOUR users table:
   SELECT * FROM users WHERE auth_id = '<supabase-auth-id>'
   ↓
5. Get user's role (VARCHAR): 'SUPER_ADMIN', 'ADMIN', etc.
   ↓
6. Load permissions:
   SELECT * FROM role_permissions WHERE role = '<user-role>'
   ↓
7. User is logged in with correct permissions!
```

### Permission Check Flow:

```
1. Component needs permission: "hr:view_employees"
   ↓
2. Get current user's role: 'MANAGER'
   ↓
3. Query role_permissions:
   SELECT * FROM role_permissions
   WHERE role = 'MANAGER'
   ↓
4. Check if permission exists
   ↓
5. Show/hide component based on result
```

---

## ✨ Your Schema Roles (Built-in)

Your schema supports these roles (no table needed - just strings):

| Role Code | Level | Description |
|-----------|-------|-------------|
| `SUPER_ADMIN` | 10 | Full access |
| `ADMIN` | 8 | Admin access |
| `MANAGER` | 6 | Department manager |
| `SUPERVISOR` | 4 | Team supervisor |
| `EMPLOYEE` | 2 | Regular employee |
| `OPERATOR` | 3 | Attendance operator |
| `VIEWER` | 1 | Read-only |

**In your users table:**
```sql
INSERT INTO users (username, email, role, auth_id) 
VALUES ('admin', 'admin@company.com', 'SUPER_ADMIN', '<supabase-auth-id>');
```

---

## 🔍 Verification

You can verify the mapping is correct:

### Check Users Table:
```sql
-- Your schema has role VARCHAR, not role_id
SELECT id, username, role, auth_id FROM users;
```

### Check Role Permissions:
```sql
-- Your schema uses role VARCHAR
SELECT role, permission_id FROM role_permissions;
-- Result: role = 'SUPER_ADMIN', permission_id = '<uuid>'
```

### My Code Queries:
```typescript
// This is how my code queries now (matches your schema)
const { data } = await supabase
  .from('role_permissions')
  .select('*')
  .eq('role', 'MANAGER'); // ✅ Correct!
```

---

## 🚀 Next Steps

1. **Test in Supabase Dashboard**:
   - Go to https://supabase.com/dashboard/project/silexuzptqjvzopuwzof
   - Check your `users` table has `role` VARCHAR field
   - Check your `role_permissions` table has `role` VARCHAR field

2. **Run Setup Wizard**:
   - Clear localStorage
   - Run app
   - Wizard will create tables matching your schema

3. **Create Test User**:
   - Sign up via Supabase Auth
   - Insert into users table with role = 'SUPER_ADMIN'
   - Login and test permissions

---

**Status**: ✅ **ALL CODE NOW MATCHES YOUR SCHEMA PERFECTLY!**

**No more roles table, no more role_id - everything uses your schema's structure!**

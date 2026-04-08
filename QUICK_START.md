# 🚀 Quick Start Guide - BioBridge Pro HR

## For New Clients / Companies

### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Click "Start your project" or "Sign In"
3. Sign up with GitHub/Google/Email

### Step 2: Create New Project
1. Click "New Project" in Supabase dashboard
2. Choose organization (or create one)
3. Enter project name (e.g., "My Company HR")
4. Set database password (save it!)
5. Choose region (closest to you)
6. Click "Create new project"
7. Wait 1-2 minutes for setup

### Step 3: Get API Credentials
1. Go to **Project Settings** (gear icon, bottom left)
2. Click **API**
3. Copy these values:
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (optional)
   ```

### Step 4: Run BioBridge Pro HR
1. Install software on your machine
2. Open the application
3. **Setup Wizard appears automatically** (first time only)

### Step 5: Complete Setup Wizard

#### **Step 1/5: Company Information**
- Enter Company Name (required)
- Enter Address (optional)
- Enter Phone & Email (optional)
- Click **Next →**

#### **Step 2/5: Database Configuration**
- Paste **Project URL** from Supabase
- Paste **anon/public key** from Supabase
- Click **Test Connection** button
- Wait for ✅ **Connected** badge
- Click **Next →**

#### **Step 3/5: Admin User Setup**
- Enter Full Name (e.g., "John Doe")
- Enter Email (e.g., "admin@company.com")
- Enter Username (default: "admin")
- Enter Password (min 6 characters)
- Click **Next →**

#### **Step 4/5: Localization**
- Choose Calendar: **Bikram Sambat (BS)** or Gregorian (AD)
- Choose Currency: **NPR**, USD, EUR, INR
- Set Timezone (default: Asia/Kathmandu)
- Set Fiscal Year Start (default: 2080-01-01)
- Click **Next →**

#### **Step 5/5: Review & Complete**
- Review all your settings
- See what will be created:
  - ✅ 6 default departments
  - ✅ 6 role levels
  - ✅ 25+ permissions
  - ✅ Default settings
  - ✅ Head Office branch
- Click **✓ Complete Setup**
- Wait for processing...
- **Redirects to Login Page**

### Step 6: Login
1. Enter your admin username & password
2. Click **Login**
3. **Dashboard appears!**

### Step 7: Start Using
1. **Add Employees**: Go to Employees → Add Employee
2. **Configure Roles**: Go to Roles & Permissions
3. **Adjust Settings**: Go to System Settings
4. **Add More Branches**: Go to Organization
5. **Setup Departments**: Go to System Settings → Company

---

## For Developers

### Run Development Server
```bash
npm install
npm run dev
```

### Port
- Default: **5173**
- If occupied, change in `vite.config.ts`

### Reset Setup (Test Wizard Again)
```javascript
// In browser console:
localStorage.removeItem('setupComplete');
localStorage.removeItem('supabaseUrl');
localStorage.removeItem('supabaseAnonKey');
location.reload();
```

### Check TypeScript Errors
```bash
npx tsc --noEmit
```

### Build for Production
```bash
npm run build
```

---

## Common Tasks

### Add New Role
1. Go to **Roles & Permissions** (sidebar)
2. Click **Add Role** button
3. Fill: Name, Code, Description, Level
4. Click **Create Role**
5. Click on new role to assign permissions
6. Click **Save Changes**

### Add Custom Setting
1. Go to **System Settings** (sidebar)
2. Click **Add Setting** button
3. Fill: Key, Value, Type, Category, Description
4. Click **Create Setting**
5. Setting appears immediately!

### Add Employee with Manager
1. Go to **Employees** (sidebar)
2. Click **Add Employee**
3. Fill employee details
4. Set **Reporting Manager** dropdown to their manager
5. Save
6. Repeat for all employees
7. View hierarchy at **Employee Hierarchy** page

### Protect Component with Permissions
```typescript
import { PermissionGuard } from '@/components/PermissionGuard';

// In your component:
<PermissionGuard requiredPermission="hr:create_employees">
  <Button>Add Employee</Button>
</PermissionGuard>
```

### Get Setting Value in Code
```typescript
import { settingsService } from '@/services/settingsService';

const value = await settingsService.getSetting('max_login_attempts', '5');
```

---

## Troubleshooting

### Setup Wizard Not Appearing
```javascript
// Clear localStorage
localStorage.clear();
location.reload();
```

### Connection Test Failing
- Check Supabase URL format: `https://xxxxx.supabase.co`
- Check key starts with: `eyJhbGci...`
- Check project is active in Supabase dashboard
- Check internet connection

### Port 5173 Already in Use
```bash
# Windows: Find process
netstat -ano | findstr ":5173"

# Kill process (replace PID)
taskkill /PID 12345 /F

# Or change port in vite.config.ts
```

### TypeScript Errors
```bash
# Fix unused variables
# Remove unused imports from files
npx tsc --noEmit  # Check errors
```

---

## Support & Documentation

- **Complete Guide**: `COMPLETE_SYSTEM_GUIDE.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Database Schema**: `supabase_schema.sql`
- **Supabase Docs**: https://supabase.com/docs

---

## Key Features Checklist

- [x] Dynamic Setup Wizard
- [x] Auto-create database tables
- [x] Role-based permissions (6 default roles)
- [x] 25+ granular permissions
- [x] Employee hierarchy tree
- [x] Dynamic system settings
- [x] Multi-tenant support
- [x] Permission guards & hooks
- [x] Department-wise assignment
- [x] Branch management
- [x] Audit logging
- [x] Settings caching

---

**Need Help?** Check `COMPLETE_SYSTEM_GUIDE.md` for detailed documentation!

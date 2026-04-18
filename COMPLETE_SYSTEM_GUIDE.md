# BioBridge Pro HR - Complete System Documentation

## 🎯 Overview

BioBridge Pro HR is now a **fully dynamic, multi-tenant, role-based HR & ERP management system** that supports:

✅ **Dynamic Setup Wizard** for new clients/companies  
✅ **Role-Based Access Control (RBAC)** with hierarchical permissions  
✅ **Employee Hierarchy Tree** with reporting relationships  
✅ **Department-wise Assignment** and monitoring  
✅ **Dynamic System Settings** - no code changes needed  
✅ **Multi-tenant Architecture** - each company has isolated data  
✅ **Auto-created Database Tables** via Supabase  

---

## 📋 Table of Contents

1. [Enhanced Setup Wizard](#1-enhanced-setup-wizard)
2. [Role-Based Permission System](#2-role-based-permission-system)
3. [Employee Hierarchy Tree](#3-employee-hierarchy-tree)
4. [Dynamic System Settings](#4-dynamic-system-settings)
5. [Permission Guard & Hooks](#5-permission-guard--hooks)
6. [Database Schema](#6-database-schema)
7. [How to Add New Client/Company](#7-how-to-add-new-clientcompany)
8. [How to Configure Permissions](#8-how-to-configure-permissions)
9. [How to Manage Settings](#9-how-to-manage-settings)

---

## 1. Enhanced Setup Wizard

### Location
`src/components/EnhancedSetupWizard.tsx`

### Features
The setup wizard is the **first thing new clients see** when they install the software. It guides them through:

#### **Step 1: Company Information**
- Company Name (required)
- Address
- Phone
- Email

#### **Step 2: Database Configuration**
- Supabase Project URL (required)
- Supabase Anon/Public Key (required)
- Supabase Service Role Key (optional)
- **Test Connection** button to verify credentials
- Instructions on how to get Supabase credentials

#### **Step 3: Admin User Setup**
- Admin Full Name
- Admin Email
- Admin Username (default: "admin")
- Admin Password (min 6 characters)

#### **Step 4: Localization Settings**
- Calendar System (Bikram Sambat / Gregorian)
- Currency (NPR, USD, EUR, INR)
- Timezone
- Fiscal Year Start Date

#### **Step 5: Review & Complete**
- Shows summary of all configuration
- Lists what will be auto-created:
  - ✅ Default departments (HR, Finance, IT, Operations, Sales, Marketing)
  - ✅ 6 role levels (Super Admin, Admin, Manager, Supervisor, Employee, Viewer)
  - ✅ 25+ granular permissions
  - ✅ Default system settings
  - ✅ Head Office branch
- On completion:
  - Creates all database tables automatically
  - Inserts default roles & permissions
  - Creates admin user
  - Saves configuration to localStorage

### How It Works
```typescript
// On "Complete Setup" click:
1. Tests Supabase connection
2. Creates organization record
3. Creates all required tables (if not exist)
4. Inserts default roles (6 levels)
5. Inserts default permissions (25+)
6. Maps permissions to roles
7. Creates default departments
8. Creates head office branch
9. Inserts default system settings
10. Creates admin user
11. Saves config to localStorage
12. Redirects to login page
```

---

## 2. Role-Based Permission System

### Location
`src/components/PermissionManagement.tsx`

### Features

#### **Roles Management**
- **Create new roles** with custom names, codes, and hierarchy levels
- **Edit existing roles**
- **Delete roles** (soft delete - sets `is_active = false`)
- **Parent-child role relationships** (e.g., Manager is parent of Supervisor)
- **Role levels** (1-10, higher = more authority)

#### **Default Roles**
| Role | Level | Description |
|------|-------|-------------|
| Super Admin | 10 | Full system access, can delete anything |
| Admin | 8 | Administrative access, cannot delete employees |
| Manager | 6 | Department-level management |
| Supervisor | 4 | Team supervision |
| Employee | 2 | Regular employee access |
| Viewer | 1 | Read-only access |

#### **Permission Modules**
| Module | Permissions |
|--------|------------|
| **HR** | view_employees, create_employees, edit_employees, delete_employees, view_hierarchy |
| **Attendance** | view_attendance, mark_attendance, edit_attendance, approve_attendance |
| **Leave** | view_leaves, apply_leave, approve_leave, reject_leave |
| **Payroll** | view_payroll, manage_payroll, process_payroll |
| **Finance** | view_finance, manage_finance, approve_payments |
| **Settings** | view_settings, manage_settings, manage_roles |
| **Reports** | view_reports, export_reports, generate_reports |

#### **UI Features**
- **Visual role selection** - click on a role card to manage its permissions
- **Search roles** by name or code
- **Module-based permission grouping** - expandable/collapsible
- **Select All / Unselect All** per module
- **Visual indicators** - green check for enabled, grey X for disabled
- **Save button** - persists changes to database
- **Add Role dialog** - form to create new roles with hierarchy

### How Permissions Work
```typescript
// Permission format: "module:permission"
// Examples:
"hr:view_employees"
"attendance:approve_attendance"
"payroll:process_payroll"

// Check permission:
hasPermission("hr:view_employees") // returns true/false
hasAnyPermission(["hr:create_employees", "hr:edit_employees"]) // returns true if ANY match
hasAllPermissions(["hr:view_employees", "hr:edit_employees"]) // returns true if ALL match
```

---

## 3. Employee Hierarchy Tree

### Location
`src/components/EmployeeHierarchyTree.tsx`

### Features

#### **Tree View**
- **Visual organizational chart** showing reporting relationships
- **Expand/Collapse** nodes to see subordinates
- **Expand All / Collapse All** buttons
- **Search employees** by name, code, or department
- **Color-coded** matches for search results
- **Badges** showing role and status (Active/Inactive)

#### **Employee Details Sidebar**
- Click any employee to see their details:
  - Full name & employee code
  - Role badge
  - Department
  - Designation
  - Branch
  - Email & Phone
  - Status (Active/Inactive)
- **Quick actions**: View Full Profile, Edit

#### **Hierarchy Structure**
```
CEO / Managing Director
├── HR Manager
│   ├── HR Supervisor
│   │   ├── HR Executive 1
│   │   └── HR Executive 2
│   └── HR Assistant
├── Finance Manager
│   ├── Accountant 1
│   └── Accountant 2
├── IT Manager
│   ├── Developer 1
│   └── Developer 2
└── Operations Manager
    └── Field Supervisor
        └── Worker 1
```

#### **Database Relationships**
- `employees.reporting_manager_id` → points to manager's `employee.id`
- This creates a **self-referential hierarchy** supporting unlimited depth
- Each employee has:
  - `department_id` → department they belong to
  - `designation_id` → their job title/position
  - `role_id` → their access level
  - `branch_id` → their office location

### How to Use
1. Navigate to **Employee Hierarchy** (sidebar menu)
2. Tree shows all active employees in organizational structure
3. Click **▶** to expand and see subordinates
4. Click on employee card to view details in right sidebar
5. Use **Search** to find specific employee
6. Click **Eye icon** to view full profile
7. Click **Edit icon** to modify employee data

---

## 4. Dynamic System Settings

### Location
`src/pages/DynamicSystemSettings.tsx`

### Features

#### **Category-Based Organization**
Settings are grouped into categories with icons:

| Category | Icon | Description |
|----------|------|-------------|
| General | ⚙️ Settings | General system configuration |
| Company | 🏢 Building | Company info & branding |
| Localization | 🌐 Globe | Regional settings & calendar |
| Security | 🛡️ Shield | Authentication & security |
| Notifications | 🔔 Bell | Email, SMS, push notifications |
| Attendance | 🕐 Clock | Attendance tracking config |
| Payroll | 💰 Dollar | Payroll & compensation |
| Database | 🗄️ Database | Database & sync config |

#### **Setting Types**
| Type | Input | Example |
|------|-------|---------|
| **String** | Text input | `company_name = "BioBridge Solutions"` |
| **Number** | Number input | `max_login_attempts = 5` |
| **Boolean** | Dropdown (Enabled/Disabled) | `enable_email_notifications = true` |
| **JSON** | Textarea (code editor) | `{"theme": "dark", "lang": "en"}` |

#### **UI Features**
- **Category filter buttons** at top - click to show only that category
- **Add Setting** button - opens dialog to create new setting
- **Inline editing** - click on any setting value to edit it
- **Delete button** (trash icon) on each setting
- **Success/Error messages** for operations
- **Public/Private flag** - controls API accessibility

#### **Default Settings Created by Setup Wizard**
```
localization:default_calendar = "BS"
localization:currency = "NPR"
localization:timezone = "Asia/Kathmandu"
localization:fiscal_year_start = "2080-01-01"

company:company_name = "<from setup>"
company:company_email = "<from setup>"
company:company_phone = "<from setup>"

security:max_login_attempts = "5"
security:session_timeout_minutes = "30"

notifications:enable_email_notifications = "true"
notifications:enable_sms_notifications = "false"

attendance:attendance_auto_sync = "true"
attendance:late_threshold_minutes = "15"

payroll:overtime_multiplier = "1.5"
```

### How to Add Custom Setting
1. Click **"Add Setting"** button
2. Fill in the form:
   - **Setting Key**: unique identifier (e.g., `max_overtime_hours`)
   - **Setting Value**: the actual value
   - **Type**: String, Number, Boolean, or JSON
   - **Category**: choose from dropdown
   - **Description**: what is this for?
   - **Public**: check if accessible via API
3. Click **"Create Setting"**
4. Setting appears immediately in the list
5. **No code changes needed!**

### How to Use Settings in Code
```typescript
import { settingsService } from '@/services/settingsService';

// Get a setting
const maxAttempts = await settingsService.getSetting('max_login_attempts', 5);

// Get multiple settings
const settings = await settingsService.getSettings([
  'max_login_attempts',
  'session_timeout_minutes',
  'enable_email_notifications'
]);

// Set a setting
await settingsService.setSetting('max_login_attempts', '10', {
  category: 'security',
  description: 'Maximum login attempts before lockout',
  setting_type: 'number'
});

// Refresh all settings
await settingsService.refresh();
```

---

## 5. Permission Guard & Hooks

### Location
- `src/hooks/usePermission.ts` - React hook for permissions
- `src/components/PermissionGuard.tsx` - React components for permission checks

### usePermission Hook

```typescript
import { usePermission } from '@/hooks/usePermission';

function MyComponent() {
  const { 
    permissions, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions,
    userRole,
    loading 
  } = usePermission(userId); // userId is optional, defaults to logged-in user

  // Check single permission
  if (hasPermission('hr:view_employees')) {
    // Show employee data
  }

  // Check if user has ANY of these permissions
  if (hasAnyPermission(['hr:create_employees', 'hr:edit_employees'])) {
    // Show add/edit buttons
  }

  // Check if user has ALL of these permissions
  if (hasAllPermissions(['hr:view_employees', 'hr:edit_employees', 'hr:delete_employees'])) {
    // Show full CRUD controls
  }
}
```

### PermissionGuard Component

```typescript
import { PermissionGuard } from '@/components/PermissionGuard';

// Show content only if user has permission
<PermissionGuard requiredPermission="hr:create_employees">
  <Button>Add Employee</Button>
</PermissionGuard>

// Require ALL permissions
<PermissionGuard 
  requiredPermission={["hr:view_employees", "hr:edit_employees"]}
  requireAll={true}
>
  <EmployeeEditor />
</PermissionGuard>

// Show custom fallback if no access
<PermissionGuard 
  requiredPermission="payroll:process_payroll"
  fallback={<p>Contact HR to process payroll</p>}
>
  <ProcessPayrollButton />
</PermissionGuard>

// Show "Access Denied" message
<PermissionGuard 
  requiredPermission="finance:approve_payments"
  showAccessDenied={true}
>
  <ApprovePaymentButton />
</PermissionGuard>
```

### PermissionButton Component

```typescript
import { PermissionButton } from '@/components/PermissionGuard';

// Button automatically disabled if no permission
<PermissionButton requiredPermission="hr:delete_employees">
  Delete Employee
</PermissionButton>

// Requires ANY of these permissions
<PermissionButton requiredPermission={["hr:create_employees", "hr:edit_employees"]}>
  Save Employee
</PermissionButton>
```

---

## 6. Database Schema

### Key Tables Created by Setup Wizard

#### **organizations**
Stores company information.
```sql
id UUID (PK)
name VARCHAR
legal_name VARCHAR
email VARCHAR
phone VARCHAR
currency VARCHAR (default: 'NPR')
timezone VARCHAR (default: 'Asia/Kathmandu')
calendar_system VARCHAR (default: 'BS')
is_active BOOLEAN
```

#### **branches**
Office locations.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
name VARCHAR
code VARCHAR
location VARCHAR
is_active BOOLEAN
```

#### **departments**
Company departments with hierarchy.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
parent_id UUID (FK → departments)  -- Self-referential for hierarchy
name VARCHAR
code VARCHAR
head_id UUID
is_active BOOLEAN
```

#### **designations**
Job titles/positions.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
name VARCHAR
code VARCHAR
level INTEGER
grade VARCHAR
is_active BOOLEAN
```

#### **roles**
User roles with hierarchy.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
name VARCHAR
code VARCHAR (UNIQUE)
description TEXT
level INTEGER (1-10, higher = more authority)
parent_role_id UUID (FK → roles)  -- Self-referential
is_active BOOLEAN
```

#### **permissions**
Granular permissions.
```sql
id UUID (PK)
module VARCHAR (hr, attendance, leave, payroll, finance, settings, reports)
permission VARCHAR (view_*, create_*, edit_*, delete_*, approve_*)
description TEXT
UNIQUE(module, permission)
```

#### **role_permissions**
Maps permissions to roles.
```sql
id UUID (PK)
role_id UUID (FK → roles)
permission_id UUID (FK → permissions)
UNIQUE(role_id, permission_id)
```

#### **users**
System users.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
username VARCHAR (UNIQUE)
email VARCHAR (UNIQUE)
password_hash VARCHAR
full_name VARCHAR
role_id UUID (FK → roles)
branch_id UUID (FK → branches)
department_id UUID (FK → departments)
designation_id UUID (FK → designations)
is_active BOOLEAN
must_change_password BOOLEAN
```

#### **employees**
Employee master with hierarchy.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
employee_code VARCHAR (UNIQUE)
full_name VARCHAR
email VARCHAR
phone VARCHAR
department_id UUID (FK → departments)
designation_id UUID (FK → designations)
role_id UUID (FK → roles)
reporting_manager_id UUID (FK → employees)  -- Self-referential hierarchy
date_of_joining DATE
employment_status VARCHAR
is_active BOOLEAN
```

#### **user_branch_access**
Multi-branch permissions.
```sql
id UUID (PK)
user_id UUID (FK → users)
branch_id UUID (FK → branches)
UNIQUE(user_id, branch_id)
```

#### **user_department_access**
Department-wise permissions.
```sql
id UUID (PK)
user_id UUID (FK → users)
department_id UUID (FK → departments)
UNIQUE(user_id, department_id)
```

#### **system_settings**
Dynamic configuration.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
setting_key VARCHAR
setting_value TEXT
setting_type VARCHAR (string, number, boolean, json)
category VARCHAR
description TEXT
is_public BOOLEAN
UNIQUE(organization_id, setting_key)
```

#### **audit_logs**
Activity tracking.
```sql
id UUID (PK)
organization_id UUID (FK → organizations)
user_id UUID (FK → users)
action VARCHAR
entity_type VARCHAR
entity_id UUID
old_value JSONB
new_value JSONB
created_at TIMESTAMPTZ
```

---

## 7. How to Add New Client/Company

### Method 1: Using Setup Wizard (Recommended)

1. **Install fresh software** on client's machine
2. **Client creates Supabase account** at https://supabase.com
3. **Client creates new project** in Supabase
4. **Run the setup wizard**:
   - Open application
   - Wizard appears automatically (first time)
   - Follow 5-step process:
     1. Enter company info
     2. Enter Supabase credentials (URL, anon key)
     3. Create admin user
     4. Set localization preferences
     5. Review and complete
5. **System auto-creates everything**:
   - All database tables
   - Default roles (6 levels)
   - Default permissions (25+)
   - Default departments
   - Default system settings
   - Admin user account
6. **Login with admin credentials**
7. **Start using the system!**

### Method 2: Manual Setup (For Developers)

1. **Create Supabase project**
2. **Run SQL schema** from `supabase_schema.sql`
3. **Update `.env` file**:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. **Run application**
5. **Manually insert organization**:
   ```sql
   INSERT INTO organizations (name, email, currency) 
   VALUES ('My Company', 'info@company.com', 'NPR');
   ```
6. **Manually create admin user**
7. **Configure settings manually** via System Settings page

---

## 8. How to Configure Permissions

### Add New Role
1. Go to **Roles & Permissions** (sidebar menu)
2. Click **"Add Role"** button
3. Fill in:
   - **Role Name**: e.g., "Department Manager"
   - **Role Code**: e.g., "DEPT_MANAGER" (auto-converted to uppercase)
   - **Description**: Optional explanation
   - **Level**: 1-10 (higher = more authority)
   - **Parent Role**: Optional (for hierarchy)
4. Click **"Create Role"**
5. New role appears in left panel

### Assign Permissions to Role
1. Click on the role in left panel
2. Right panel shows all permission modules
3. Click **module header** to expand/collapse
4. Click **"Select All"** to enable all permissions in module
5. Click **individual permission** to toggle it
6. Green check = enabled, Grey X = disabled
7. Click **"Save Changes"** button
8. Permissions applied immediately!

### Permission Examples

**HR Manager Role:**
```
✅ hr:view_employees
✅ hr:edit_employees
✅ hr:view_hierarchy
✅ attendance:view_attendance
✅ attendance:approve_attendance
✅ leave:view_leaves
✅ leave:approve_leave
✅ reports:view_reports
✅ reports:export_reports
```

**Accountant Role:**
```
✅ finance:view_finance
✅ finance:manage_finance
✅ payroll:view_payroll
✅ payroll:manage_payroll
✅ reports:view_reports
✅ reports:export_reports
```

**Intern Role:**
```
✅ hr:view_employees (view only colleagues)
✅ attendance:view_attendance (view own)
✅ leave:apply_leave
```

---

## 9. How to Manage Settings

### View Settings
1. Go to **System Settings** (sidebar menu)
2. Settings grouped by categories
3. Click category buttons at top to filter

### Edit Setting
1. Find the setting in the list
2. Click on the value field
3. Type new value
4. **Auto-saves** on change!
5. Success message appears

### Add Custom Setting
1. Click **"Add Setting"** button
2. Fill form:
   - **Setting Key**: `my_custom_setting` (required, unique)
   - **Setting Value**: `some value` (required)
   - **Type**: String / Number / Boolean / JSON
   - **Category**: General / Company / Localization / etc.
   - **Description**: `What is this for?`
   - **Public**: Check if accessible via API
3. Click **"Create Setting"**
4. Setting appears immediately!

### Delete Setting
1. Find the setting
2. Click **Trash icon** on the right
3. Confirm deletion
4. Setting removed immediately

### Use Settings in Code
```typescript
import { settingsService } from '@/services/settingsService';

// In your component:
const [maxAttempts, setMaxAttempts] = useState(5);

useEffect(() => {
  // Load setting
  const max = await settingsService.getSetting('max_login_attempts', 5);
  setMaxAttempts(max);
}, []);

// Save setting
await settingsService.setSetting('max_login_attempts', '10', {
  category: 'security',
  description: 'Maximum login attempts before account lockout',
  setting_type: 'number'
});
```

---

## 🔧 Technical Architecture

### File Structure
```
src/
├── components/
│   ├── EnhancedSetupWizard.tsx      # New client setup wizard
│   ├── PermissionManagement.tsx     # Role & permission manager
│   ├── EmployeeHierarchyTree.tsx    # Org chart tree view
│   ├── PermissionGuard.tsx          # Permission protection components
│   └── ...
├── hooks/
│   ├── usePermission.ts             # Permission hook
│   └── ...
├── services/
│   ├── settingsService.ts           # Dynamic settings service
│   └── ...
├── pages/
│   ├── DynamicSystemSettings.tsx    # Settings page
│   └── ...
├── config/
│   ├── supabase.ts                  # Supabase client (dynamic init)
│   └── ...
├── context/
│   ├── AuthContext.tsx              # Authentication
│   └── ...
└── layout/
    └── MainLayout.tsx               # Main layout with sidebar
```

### Data Flow

```
Setup Wizard
    ↓
Creates Organization
    ↓
Creates Database Tables
    ↓
Creates Roles & Permissions
    ↓
Creates Departments & Branches
    ↓
Creates System Settings
    ↓
Creates Admin User
    ↓
User Logs In
    ↓
usePermission loads user's permissions
    ↓
PermissionGuard protects routes/components
    ↓
settingsService loads dynamic settings
    ↓
App uses settings for behavior
```

---

## 🚀 Quick Start Guide for New Clients

1. **Install BioBridge Pro HR**
2. **Create Supabase account** (https://supabase.com)
3. **Create new project** in Supabase
4. **Copy credentials**:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon Key: `eyJhbGci...`
5. **Run application**
6. **Setup Wizard appears**
7. **Follow 5 steps**:
   - Enter company name
   - Paste Supabase credentials → Test Connection
   - Create admin account
   - Set calendar & currency
   - Review → Complete Setup
8. **Login as admin**
9. **Go to Roles & Permissions** to customize access
10. **Go to System Settings** to configure options
11. **Start adding employees!**

---

## 📞 Support

For technical support or custom development:
- Check `README.md` in project root
- Review `supabase_schema.sql` for complete database structure
- Inspect component files for implementation details

---

## ✨ Key Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Dynamic Setup Wizard | ✅ | 5-step wizard for new clients |
| Auto Table Creation | ✅ | Creates all tables automatically |
| Role-Based Access | ✅ | 6 default roles, create custom |
| Permission Management | ✅ | 25+ granular permissions |
| Employee Hierarchy | ✅ | Tree view with reporting structure |
| Department Assignment | ✅ | Multi-department support |
| Dynamic Settings | ✅ | No-code configuration |
| Multi-Tenant | ✅ | Each company isolated |
| Permission Guards | ✅ | Protect routes & components |
| Branch Management | ✅ | Multi-branch support |
| Audit Logging | ✅ | Track all changes |
| Caching | ✅ | Settings cached for performance |

---

**Version**: 2.0.0  
**Last Updated**: 2026-04-08  
**Database**: Supabase (PostgreSQL)  
**Frontend**: React + TypeScript + Tailwind CSS

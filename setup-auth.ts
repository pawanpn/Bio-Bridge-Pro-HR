import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silexuzptqjvzopuwzof.supabase.co';
const SUPABASE_SECRET_KEY = 'sb_secret_Ldjm1T3yD3EWGbfle-OdAA__15-r63x';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function setupAuthentication() {
  console.log('🔐 Setting up Supabase Authentication...\n');

  // Step 1: Create admin user via Supabase Admin API
  console.log('📝 Step 1: Creating Admin User in Supabase Auth...\n');

  const adminEmail = 'admin@biobridge.com';
  const adminPassword = 'Admin@12345';

  try {
    // Create user via Admin API (using service role key)
    const response = await fetch(`${SUPABASE_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: 'System Administrator',
          role: 'SUPER_ADMIN'
        }
      })
    });

    const userData = await response.json();

    if (!response.ok) {
      if (userData.message && userData.message.includes('already exists')) {
        console.log('  ⚠️  Admin user already exists in Auth\n');
        // Get existing user
        const listResponse = await fetch(`${SUPABASE_URL}/admin/users?email=${encodeURIComponent(adminEmail)}`, {
          headers: {
            'apikey': SUPABASE_SECRET_KEY,
            'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
          }
        });
        const listData = await listResponse.json();
        if (listData.users && listData.users.length > 0) {
          userData.id = listData.users[0].id;
        }
      } else {
        console.error('  ❌ Failed to create user:', userData.message || userData, '\n');
        process.exit(1);
      }
    }

    const authUserId = userData.id;
    console.log('  ✓ Admin user created/exists in Supabase Auth');
    console.log('  ✓ Auth User ID:', authUserId);
    console.log('  ✓ Email:', adminEmail);
    console.log('  ✓ Password:', adminPassword, '\n');

    // Step 2: Check if organization exists
    console.log('🏢 Step 2: Checking Organization...\n');

    let orgId;
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .single();

    if (!orgData) {
      // Create organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'BioBridge ERP',
          legal_name: 'BioBridge Solutions Pvt. Ltd.',
          email: adminEmail,
          country: 'Nepal',
          currency: 'NPR',
          timezone: 'Asia/Kathmandu'
        })
        .select()
        .single();

      if (orgError) {
        console.error('  ❌ Failed to create organization:', orgError.message, '\n');
        process.exit(1);
      }

      orgId = newOrg.id;
      console.log('  ✓ Organization created');
    } else {
      orgId = orgData.id;
      console.log('  ✓ Organization exists');
    }
    console.log('  ✓ Organization ID:', orgId, '\n');

    // Step 3: Check if branches exist, create if not
    console.log('🏬 Step 3: Checking Branch...\n');

    let branchId;
    const { data: branchData } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', orgId)
      .single();

    if (!branchData) {
      const { data: newBranch } = await supabase
        .from('branches')
        .insert({
          organization_id: orgId,
          name: 'Head Office',
          code: 'HO',
          location: 'Kathmandu'
        })
        .select()
        .single();
      
      branchId = newBranch?.id;
      console.log('  ✓ Branch created\n');
    } else {
      branchId = branchData.id;
      console.log('  ✓ Branch exists\n');
    }

    // Step 4: Check if departments exist, create if not
    console.log('🏛️  Step 4: Checking Departments...\n');

    const { count: deptCount } = await supabase
      .from('departments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (!deptCount || deptCount === 0) {
      const departments = [
        { name: 'Human Resources', code: 'HR', organization_id: orgId },
        { name: 'Finance & Accounting', code: 'FINANCE', organization_id: orgId },
        { name: 'Information Technology', code: 'IT', organization_id: orgId },
        { name: 'Operations', code: 'OPS', organization_id: orgId },
        { name: 'Sales & Marketing', code: 'SALES', organization_id: orgId },
        { name: 'Administration', code: 'ADMIN', organization_id: orgId }
      ];

      await supabase.from('departments').insert(departments);
      console.log('  ✓ 6 departments created\n');
    } else {
      console.log(`  ✓ ${deptCount} departments exist\n`);
    }

    // Step 5: Check if permissions exist, create if not
    console.log('🔑 Step 5: Checking Permissions...\n');

    const { count: permCount } = await supabase
      .from('permissions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    let permissions = [];

    if (!permCount || permCount === 0) {
      const perms = [
        { module: 'hr', permission: 'view_employees', description: 'View employee details' },
        { module: 'hr', permission: 'create_employees', description: 'Add new employees' },
        { module: 'hr', permission: 'edit_employees', description: 'Edit employee information' },
        { module: 'hr', permission: 'delete_employees', description: 'Delete employees' },
        { module: 'hr', permission: 'view_hierarchy', description: 'View organizational hierarchy' },
        { module: 'attendance', permission: 'view_attendance', description: 'View attendance records' },
        { module: 'attendance', permission: 'mark_attendance', description: 'Mark attendance' },
        { module: 'attendance', permission: 'edit_attendance', description: 'Edit attendance records' },
        { module: 'attendance', permission: 'approve_attendance', description: 'Approve attendance' },
        { module: 'leave', permission: 'view_leaves', description: 'View leave requests' },
        { module: 'leave', permission: 'apply_leave', description: 'Apply for leave' },
        { module: 'leave', permission: 'approve_leave', description: 'Approve leave requests' },
        { module: 'leave', permission: 'reject_leave', description: 'Reject leave requests' },
        { module: 'payroll', permission: 'view_payroll', description: 'View payroll data' },
        { module: 'payroll', permission: 'manage_payroll', description: 'Manage payroll' },
        { module: 'payroll', permission: 'process_payroll', description: 'Process payroll runs' },
        { module: 'finance', permission: 'view_finance', description: 'View financial data' },
        { module: 'finance', permission: 'manage_finance', description: 'Manage finances' },
        { module: 'finance', permission: 'approve_payments', description: 'Approve payments' },
        { module: 'settings', permission: 'view_settings', description: 'View settings' },
        { module: 'settings', permission: 'manage_settings', description: 'Manage system settings' },
        { module: 'settings', permission: 'manage_roles', description: 'Manage roles and permissions' },
        { module: 'reports', permission: 'view_reports', description: 'View reports' },
        { module: 'reports', permission: 'export_reports', description: 'Export reports' },
        { module: 'reports', permission: 'generate_reports', description: 'Generate custom reports' }
      ].map(p => ({ ...p, organization_id: orgId }));

      const { data: insertedPerms } = await supabase.from('permissions').insert(perms).select();
      permissions = insertedPerms || [];
      console.log(`  ✓ ${permissions.length} permissions created\n`);
    } else {
      const { data: existingPerms } = await supabase
        .from('permissions')
        .select('*')
        .eq('organization_id', orgId);
      permissions = existingPerms || [];
      console.log(`  ✓ ${permCount} permissions exist\n`);
    }

    // Step 6: Check if role_permissions exist, create if not
    console.log('🎭 Step 6: Checking Role Permissions...\n');

    const { count: rpCount } = await supabase
      .from('role_permissions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (!rpCount || rpCount === 0 && permissions.length > 0) {
      const rolePermissions = [];
      const roles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'OPERATOR', 'VIEWER'];

      // SUPER_ADMIN - all
      permissions.forEach(perm => {
        rolePermissions.push({ role: 'SUPER_ADMIN', permission_id: perm.id, organization_id: orgId });
      });

      // ADMIN
      permissions.filter(p => !['delete_employees', 'manage_settings'].includes(p.permission))
        .forEach(perm => {
          rolePermissions.push({ role: 'ADMIN', permission_id: perm.id, organization_id: orgId });
        });

      // MANAGER
      permissions.filter(p => ['view_employees', 'view_attendance', 'approve_attendance', 'view_leaves', 'approve_leave', 'view_payroll', 'view_reports', 'export_reports'].includes(p.permission))
        .forEach(perm => {
          rolePermissions.push({ role: 'MANAGER', permission_id: perm.id, organization_id: orgId });
        });

      // EMPLOYEE
      permissions.filter(p => ['view_employees', 'apply_leave', 'view_attendance', 'view_reports'].includes(p.permission))
        .forEach(perm => {
          rolePermissions.push({ role: 'EMPLOYEE', permission_id: perm.id, organization_id: orgId });
        });

      // OPERATOR
      permissions.filter(p => ['view_attendance', 'mark_attendance'].includes(p.permission))
        .forEach(perm => {
          rolePermissions.push({ role: 'OPERATOR', permission_id: perm.id, organization_id: orgId });
        });

      // VIEWER
      permissions.filter(p => p.permission.startsWith('view_'))
        .forEach(perm => {
          rolePermissions.push({ role: 'VIEWER', permission_id: perm.id, organization_id: orgId });
        });

      await supabase.from('role_permissions').insert(rolePermissions);
      console.log(`  ✓ Permissions assigned to ${roles.length} roles\n`);
    } else {
      console.log('  ✓ Role permissions exist\n');
    }

    // Step 7: Create or update user profile in users table
    console.log('👤 Step 7: Creating User Profile...\n');

    // Check if user profile exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUserId)
      .single();

    if (!existingUser) {
      // Create user profile
      const { error: userError } = await supabase
        .from('users')
        .insert({
          auth_id: authUserId,
          username: 'admin',
          email: adminEmail,
          full_name: 'System Administrator',
          role: 'SUPER_ADMIN',
          organization_id: orgId,
          branch_id: branchId,
          is_active: true,
          must_change_password: false
        });

      if (userError) {
        console.error('  ❌ Failed to create user profile:', userError.message, '\n');
        // Try update instead
        const { error: updateError } = await supabase
          .from('users')
          .update({
            username: 'admin',
            email: adminEmail,
            full_name: 'System Administrator',
            role: 'SUPER_ADMIN',
            organization_id: orgId,
            branch_id: branchId,
            is_active: true,
            must_change_password: false
          })
          .eq('auth_id', authUserId);

        if (updateError) {
          console.error('  ❌ Failed to update user:', updateError.message, '\n');
          process.exit(1);
        }
      }

      console.log('  ✓ User profile created in users table');
    } else {
      // Update existing user
      await supabase
        .from('users')
        .update({
          role: 'SUPER_ADMIN',
          organization_id: orgId,
          branch_id: branchId,
          is_active: true,
          must_change_password: false
        })
        .eq('auth_id', authUserId);

      console.log('  ✓ User profile updated');
    }

    console.log('  ✓ Auth ID:', authUserId);
    console.log('  ✓ Role: SUPER_ADMIN');
    console.log('  ✓ Username: admin\n');

    // Final summary
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Authentication Setup Complete!                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log('📋 LOGIN CREDENTIALS:\n');
    console.log('  Email:', adminEmail);
    console.log('  Password:', adminPassword);
    console.log('  Role: SUPER_ADMIN\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 HOW TO LOGIN:\n');
    console.log('1. Open application: http://localhost:5173');
    console.log('2. On login page, enter:');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
    console.log('3. Click "Sign In"');
    console.log('4. You will be logged in as SUPER_ADMIN!\n');
    console.log('⚠️  IMPORTANT: Change password after first login!\n');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run
setupAuthentication();

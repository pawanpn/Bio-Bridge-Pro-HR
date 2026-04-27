import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://silexuzptqjvzopuwzof.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_Ldjm1T3yD3EWGbfle-OdAA__15-r63x';
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const ACCOUNTS = [
  {
    email: 'master_admin@biobridge.com',
    password: 'masterpassword',
    username: 'master_admin',
    fullName: 'Master Admin',
    role: 'SUPER_ADMIN',
  },
  {
    email: 'client_hr@biobridge.com',
    password: 'clientpassword',
    username: 'client_hr',
    fullName: 'Client HR',
    role: 'ORG_SUPERADMIN',
  },
];

async function upsertAuthUser(account) {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Failed to list users: ${listError.message}`);

  const existing = listData.users.find((user) => user.email === account.email);
  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: account.role },
    });
    if (updateError) throw new Error(`Failed to update auth user ${account.email}: ${updateError.message}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName, role: account.role },
  });
  if (error) throw new Error(`Failed to create auth user ${account.email}: ${error.message}`);
  return data.user.id;
}

async function ensureOrg() {
  const { data: existingOrg, error: orgError } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
  if (orgError) throw new Error(`Failed to load organization: ${orgError.message}`);

  let organizationId = existingOrg?.id;
  if (!organizationId) {
    const { data: newOrg, error: createOrgError } = await supabase
      .from('organizations')
      .insert({
        name: 'BioBridge HR',
        legal_name: 'BioBridge HR Private Limited',
        email: 'client_hr@biobridge.com',
        country: 'Nepal',
        currency: 'NPR',
        timezone: 'Asia/Kathmandu',
      })
      .select('id')
      .single();
    if (createOrgError) throw new Error(`Failed to create organization: ${createOrgError.message}`);
    organizationId = newOrg.id;
  }
  return organizationId;
}

async function ensurePermissionsAndRoles(organizationId) {
  const permissions = [
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
    { module: 'reports', permission: 'generate_reports', description: 'Generate custom reports' },
  ];

  const { data: existingPerms, error: readError } = await supabase
    .from('permissions')
    .select('id, module, permission')
    .eq('organization_id', organizationId);

  if (readError) {
    console.warn(`Skipping permissions seed because permissions table is unavailable: ${readError.message}`);
    return;
  }

  const existingMap = new Map((existingPerms || []).map((perm) => [`${perm.module}:${perm.permission}`, perm.id]));
  const missingPerms = permissions.filter((perm) => !existingMap.has(`${perm.module}:${perm.permission}`));

  if (missingPerms.length > 0) {
    const { data: insertedPerms, error: permError } = await supabase
      .from('permissions')
      .insert(missingPerms.map((perm) => ({ ...perm, organization_id: organizationId })))
      .select('id, module, permission');
    if (permError) {
      console.warn(`Skipping permissions insert because the table is unavailable or mismatched: ${permError.message}`);
      return;
    }
    for (const perm of insertedPerms || []) {
      existingMap.set(`${perm.module}:${perm.permission}`, perm.id);
    }
  }

  for (const role of ['SUPER_ADMIN', 'ORG_SUPERADMIN']) {
    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('organization_id', organizationId).eq('role', role);
    if (deleteError) {
      console.warn(`Skipping role_permissions cleanup for ${role}: ${deleteError.message}`);
      continue;
    }
    const payload = permissions
      .map((perm) => {
        const id = existingMap.get(`${perm.module}:${perm.permission}`);
        return id ? { organization_id: organizationId, role, permission_id: id } : null;
      })
      .filter(Boolean);
    if (payload.length > 0) {
      const { error } = await supabase.from('role_permissions').insert(payload);
      if (error) {
        console.warn(`Skipping role_permissions insert for ${role}: ${error.message}`);
      }
    }
  }
}

async function upsertUserProfile(authUserId, account, organizationId, branchId) {
  const payload = {
    auth_id: authUserId,
    username: account.username,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    is_active: true,
    must_change_password: false,
  };

  const scopedPayload = {
    ...payload,
    organization_id: organizationId,
    branch_id: branchId,
  };
  const fallbackPayload = {
    ...payload,
    organization_id: null,
    branch_id: null,
  };

  const { data: existingProfile } = await supabase.from('users').select('id').eq('auth_id', authUserId).maybeSingle();
  if (existingProfile) {
    let { error } = await supabase.from('users').update(scopedPayload).eq('auth_id', authUserId);
    if (error) {
      console.warn(`Retrying profile update without org/branch scope for ${account.email}: ${error.message}`);
      ({ error } = await supabase.from('users').update(fallbackPayload).eq('auth_id', authUserId));
    }
    if (error) throw new Error(`Failed to update profile ${account.email}: ${error.message}`);
  } else {
    let { error } = await supabase.from('users').insert(scopedPayload);
    if (error) {
      console.warn(`Retrying profile insert without org/branch scope for ${account.email}: ${error.message}`);
      ({ error } = await supabase.from('users').insert(fallbackPayload));
    }
    if (error) throw new Error(`Failed to create profile ${account.email}: ${error.message}`);
  }
}

async function main() {
  console.log('Seeding test users...');
  const organizationId = await ensureOrg();
  await ensurePermissionsAndRoles(organizationId);

  for (const account of ACCOUNTS) {
    const authUserId = await upsertAuthUser(account);
    await upsertUserProfile(authUserId, account, organizationId, null);
    console.log(`Seeded ${account.username} (${account.role})`);
  }

  console.log('Dual-user seed complete.');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

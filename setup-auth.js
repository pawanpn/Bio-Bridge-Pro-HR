import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silexuzptqjvzopuwzof.supabase.co';
const SUPABASE_SECRET_KEY = 'sb_secret_Ldjm1T3yD3EWGbfle-OdAA__15-r63x';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function main() {
  console.log('🔐 Testing Supabase Connection...\n');

  // Test connection by checking organizations table
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (orgError) {
    console.log('❌ Connection error:', orgError.message);
    console.log('\n⚠️  Tables may not exist yet.');
    console.log('\n📋 Please run this SQL in Supabase SQL Editor first:\n');
    console.log('https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/sql/new\n');
    return;
  }

  console.log('✅ Connected to Supabase!\n');
  
  if (orgs && orgs.length > 0) {
    console.log('✓ Organization exists:', orgs[0].name);
  } else {
    console.log('⚠️  No organizations found');
  }

  // Check users table
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (userError) {
    console.log('\n❌ Users table error:', userError.message);
  } else {
    console.log('✓ Users table accessible');
    if (users && users.length > 0) {
      console.log('✓ Found', users.length, 'user(s)');
    } else {
      console.log('⚠️  No users found - need to create admin');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 MANUAL SETUP INSTRUCTIONS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Since direct Auth API failed, follow these steps:\n');
  console.log('1. Go to Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/silexuzptqjvzopuwzof/auth/users\n');
  console.log('2. Click "Add user" button');
  console.log('3. Fill in:');
  console.log('   Email: admin@biobridge.com');
  console.log('   Password: Admin@12345');
  console.log('   Auto Confirm User: ✓ CHECK THIS');
  console.log('4. Click "Create user"');
  console.log('5. Copy the User ID (UUID) shown\n');
  console.log('6. Go to Table Editor → users table');
  console.log('7. Click "Insert" and add:');
  console.log('   - auth_id: (paste the UUID from step 5)');
  console.log('   - username: admin');
  console.log('   - email: admin@biobridge.com');
  console.log('   - full_name: System Administrator');
  console.log('   - role: SUPER_ADMIN');
  console.log('   - is_active: true');
  console.log('   - must_change_password: false\n');
  console.log('8. Save and login!\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(' LOGIN CREDENTIALS:\n');
  console.log('   Email: admin@biobridge.com');
  console.log('   Password: Admin@12345\n');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();

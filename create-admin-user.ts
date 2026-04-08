import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://silexuzptqjvzopuwzof.supabase.co';
const SUPABASE_SECRET_KEY = 'sb_secret_Ldjm1T3yD3EWGbfle-OdAA__15-r63x';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function createAdminUser() {
  console.log('🔐 Creating Admin User in Supabase Auth...\n');

  const email = 'admin@biobridge.com';
  const password = 'Admin@12345';

  try {
    // Step 1: Check if user already exists in auth
    console.log('Step 1: Checking if user exists...\n');
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Failed to list users:', listError.message);
      // Continue anyway
    }

    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      console.log('✅ User already exists in Auth');
      console.log('   User ID:', existingUser.id);
      console.log('   Email confirmed:', existingUser.email_confirmed_at ? 'Yes' : 'No');

      // Update password anyway
      console.log('\n   Updating password to:', password);
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password
      });

      if (updateError) {
        console.error('❌ Failed to update password:', updateError.message);
      } else {
        console.log('✅ Password updated successfully');
      }
    } else {
      console.log('⚠️ User does not exist. Creating now...\n');

      // Step 2: Create user via Admin API
      const response = await fetch(`${SUPABASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SECRET_KEY,
          'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            full_name: 'System Administrator',
            role: 'SUPER_ADMIN'
          }
        })
      });

      const userData = await response.json();

      if (!response.ok) {
        console.error('❌ Failed to create user:', userData);
        process.exit(1);
      }

      console.log('✅ User created successfully!');
      console.log('   User ID:', userData.user.id);
      console.log('   Email:', userData.user.email);
      console.log('   Email confirmed: Yes (auto-confirmed)');

      existingUser = userData.user;
    }

    // Step 3: Check organization and branch
    console.log('\n📊 Step 2: Checking organization and branch...\n');

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .single();

    if (!org) {
      console.error('❌ No organization found in database');
      console.log('   Please create an organization first');
      process.exit(1);
    }

    console.log('✅ Organization found:', org.id);

    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .single();

    if (!branch) {
      console.error('❌ No branch found in database');
      console.log('   Please create a branch first');
      process.exit(1);
    }

    console.log('✅ Branch found:', branch.id);

    // Step 4: Create/update user profile in public.users
    console.log('\n👤 Step 3: Creating user profile...\n');

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', existingUser.id)
      .single();

    if (existingProfile) {
      console.log('✅ User profile exists, updating...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username: 'admin',
          email: email,
          full_name: 'System Administrator',
          role: 'SUPER_ADMIN',
          organization_id: org.id,
          branch_id: branch.id,
          is_active: true,
          must_change_password: false
        })
        .eq('auth_id', existingUser.id);

      if (updateError) {
        console.error('❌ Failed to update profile:', updateError.message);
        process.exit(1);
      }

      console.log('✅ User profile updated successfully');
    } else {
      console.log('   Creating new user profile...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          auth_id: existingUser.id,
          username: 'admin',
          email: email,
          full_name: 'System Administrator',
          role: 'SUPER_ADMIN',
          organization_id: org.id,
          branch_id: branch.id,
          is_active: true,
          must_change_password: false
        });

      if (insertError) {
        console.error('❌ Failed to create profile:', insertError.message);
        process.exit(1);
      }

      console.log('✅ User profile created successfully');
    }

    // Step 5: Final verification
    console.log('\n✅✅✅ SETUP COMPLETE! ✅✅✅\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 LOGIN CREDENTIALS:\n');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Role: SUPER_ADMIN\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 HOW TO LOGIN:\n');
    console.log('1. Open: http://localhost:5173');
    console.log('2. Refresh the page (Ctrl+R)');
    console.log('3. Enter credentials above');
    console.log('4. Click "Sign In"');
    console.log('5. ✅ Dashboard will appear!\n');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createAdminUser();

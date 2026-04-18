import { supabase } from './src/config/supabase';

async function testConnection() {
  console.log('🔌 Testing Supabase Connection...\n');
  
  try {
    // Test 1: Basic connectivity
    console.log('Test 1: Checking connection...');
    const { data, error } = await supabase
      .from('organizations')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('✅ Connection successful!');
        console.log('⚠️  Tables not created yet (this is expected for first setup)\n');
      } else {
        console.log('❌ Connection failed:', error.message);
        return;
      }
    } else {
      console.log('✅ Connection successful!');
      console.log('✅ Database is accessible\n');
    }
    
    // Test 2: Check if setup is complete
    const isSetupComplete = localStorage.getItem('setupComplete') === 'true';
    console.log('Setup Status:', isSetupComplete ? '✅ Complete' : '⚠️  Not complete\n');
    
    if (!isSetupComplete) {
      console.log('📝 Next Steps:');
      console.log('1. Run: npm run dev');
      console.log('2. The Setup Wizard will appear automatically');
      console.log('3. Follow the 5-step wizard to complete setup');
      console.log('4. Your Supabase credentials are already configured!\n');
    } else {
      console.log('✅ System is ready to use!');
      console.log('📝 Run: npm run dev');
    }
    
  } catch (err: any) {
    console.log('❌ Error:', err.message);
  }
}

testConnection();

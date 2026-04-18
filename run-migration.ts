import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Adding is_active column to employees table...');

  const sql = fs.readFileSync(path.join(__dirname, 'ADD_IS_ACTIVE_COLUMN.sql'), 'utf-8');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n⚠️  Please run this SQL manually in your Supabase SQL Editor:');
    console.log(sql);
    process.exit(1);
  }

  console.log('✅ Migration completed successfully!');
  console.log('📋 Column is_active added to employees table');
}

runMigration();

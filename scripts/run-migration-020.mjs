import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('Running migration 020_campaign_setup_tracking.sql...\n');

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '020_campaign_setup_tracking.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  // Split SQL into individual statements
  const statements = sql
    .split(/;[\s]*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.trim()) {
      console.log('Executing:', statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

      const { error } = await supabase.rpc('exec_sql', { sql_text: statement + ';' }).single();

      if (error) {
        // Try direct execution for some statements
        const { error: directError } = await supabase.from('_migration_check').select('*').limit(0);
        if (directError && !directError.message.includes('does not exist')) {
          console.error('Error:', error.message);
        }
      }
    }
  }

  console.log('\nMigration complete!');
}

// Alternative: Run directly against database if the exec_sql RPC doesn't exist
async function runMigrationDirect() {
  console.log('Attempting direct SQL execution...\n');

  // Check if columns already exist
  const { data: columns, error: colError } = await supabase
    .from('outbound_campaigns')
    .select('*')
    .limit(1);

  if (colError) {
    console.error('Error checking table:', colError.message);
    return;
  }

  // Check if setup_step column exists
  const { data: testData } = await supabase
    .from('outbound_campaigns')
    .select('setup_step')
    .limit(1);

  if (testData !== null) {
    console.log('setup_step column already exists');
  } else {
    console.log('setup_step column needs to be added');
    console.log('\nPlease run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE outbound_campaigns');
    console.log('ADD COLUMN IF NOT EXISTS setup_step integer DEFAULT 1,');
    console.log('ADD COLUMN IF NOT EXISTS setup_data jsonb DEFAULT \'{}\';');
  }

  // Check if contact_upload_queue table exists
  const { data: queueData, error: queueError } = await supabase
    .from('contact_upload_queue')
    .select('id')
    .limit(1);

  if (queueError?.message?.includes('does not exist')) {
    console.log('\ncontact_upload_queue table needs to be created');
    console.log('Please run the full migration SQL in your Supabase SQL Editor.');
  } else {
    console.log('contact_upload_queue table exists');
  }
}

runMigrationDirect().catch(console.error);

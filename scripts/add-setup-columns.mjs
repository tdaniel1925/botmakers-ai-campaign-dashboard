import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumns() {
  console.log('Adding setup_step and setup_data columns to outbound_campaigns...\n');

  // First, try to see if the columns exist by selecting them
  const { data, error } = await supabase
    .from('outbound_campaigns')
    .select('id, name, setup_step, setup_data')
    .limit(1);

  if (error) {
    if (error.message.includes('setup_step')) {
      console.log('Column setup_step does not exist yet.');
      console.log('\nPlease run this SQL in the Supabase Dashboard SQL Editor:\n');
      console.log('ALTER TABLE outbound_campaigns');
      console.log('ADD COLUMN IF NOT EXISTS setup_step integer DEFAULT 1,');
      console.log('ADD COLUMN IF NOT EXISTS setup_data jsonb DEFAULT \'{}\';');
    } else {
      console.error('Error:', error.message);
    }
  } else {
    console.log('Columns already exist!');
    console.log('Sample data:', data);
  }
}

addColumns().catch(console.error);

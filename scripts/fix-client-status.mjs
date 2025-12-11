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

async function fixClientStatus() {
  console.log('Fetching clients without accepted_at...\n');

  // Find clients without accepted_at set
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, accepted_at, invite_status, is_active')
    .is('accepted_at', null);

  if (error) {
    console.error('Error fetching clients:', error);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('No clients need to be fixed.');
    return;
  }

  // Get all auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData?.users || [];

  console.log(`Found ${clients.length} client(s) without accepted_at:\n`);

  for (const client of clients) {
    console.log(`- ${client.name} (${client.email})`);
    console.log(`  invite_status: ${client.invite_status}`);
    console.log(`  is_active: ${client.is_active}`);

    // Find auth user by email
    const authUser = authUsers.find(u => u.email?.toLowerCase() === client.email.toLowerCase());

    if (authUser) {
      console.log(`  auth_user_id: ${authUser.id}`);
      console.log(`  last_sign_in_at: ${authUser.last_sign_in_at || 'never'}`);

      if (authUser.last_sign_in_at) {
        // Update the client's accepted_at to their first sign in
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            accepted_at: authUser.last_sign_in_at,
            invite_status: 'accepted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id);

        if (updateError) {
          console.log(`  ERROR updating: ${updateError.message}`);
        } else {
          console.log(`  FIXED: Set accepted_at to ${authUser.last_sign_in_at}`);
        }
      } else {
        console.log('  No sign-in detected yet');
      }
    } else {
      console.log('  No auth user found for this email');
    }
    console.log('');
  }

  console.log('Done!');
}

fixClientStatus();

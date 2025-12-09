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

async function addAdmin() {
  const email = 'tdaniel@botmakers.ai';
  const name = 'Trent Daniel';
  const tempPassword = 'TempAdmin123!';

  // First check if auth user exists
  const { data: authData } = await supabase.auth.admin.listUsers();
  let user = authData?.users?.find(u => u.email === email);

  if (!user) {
    console.log('Auth user not found, creating new one...');

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      return;
    }

    user = newUser.user;
    console.log('Created auth user:', user.id);
    console.log('Temporary password:', tempPassword);
  } else {
    console.log('Found existing auth user:', user.id);
  }

  // First try to delete any existing admin_users with this email but different ID
  const { error: deleteError } = await supabase
    .from('admin_users')
    .delete()
    .eq('email', email)
    .neq('id', user.id);

  if (deleteError) {
    console.log('No conflicting records or delete error:', deleteError.message);
  }

  // Insert into admin_users
  const { data, error } = await supabase
    .from('admin_users')
    .upsert({
      id: user.id,
      email,
      name,
      role: 'super_admin',
      is_active: true,
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (error) {
    console.error('Error adding to admin_users:', error);
  } else {
    console.log('Admin user added successfully to admin_users table');
  }
}

addAdmin();

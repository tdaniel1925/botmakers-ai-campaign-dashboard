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

async function updatePassword() {
  const email = 'tdaniel@botmakers.ai';
  const newPassword = '4Xkilla1@';

  // Find the user
  const { data: authData } = await supabase.auth.admin.listUsers();
  const user = authData?.users?.find(u => u.email === email);

  if (!user) {
    console.error('User not found:', email);
    return;
  }

  console.log('Found user:', user.id);

  // Update password
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log('Password updated successfully for:', email);
  }
}

updatePassword();

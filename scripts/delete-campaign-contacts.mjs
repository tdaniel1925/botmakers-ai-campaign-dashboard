import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteContacts() {
  const campaignId = '0ec7bc73-2c39-4252-9f4b-3586cc2bed3a';

  console.log('Deleting all contacts from campaign:', campaignId);

  // Delete all contacts
  const { error: deleteError } = await supabase
    .from('campaign_contacts')
    .delete()
    .eq('campaign_id', campaignId);

  if (deleteError) {
    console.error('Error deleting contacts:', deleteError);
    return;
  }

  // Reset total_contacts on the campaign
  const { error: updateError } = await supabase
    .from('outbound_campaigns')
    .update({ total_contacts: 0, updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  if (updateError) {
    console.error('Error updating campaign:', updateError);
    return;
  }

  console.log('✓ All contacts deleted successfully!');
  console.log('You can now re-upload the CSV with proper column mapping.');
}

deleteContacts().catch(console.error);

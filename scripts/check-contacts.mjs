import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkContacts() {
  console.log("Checking campaigns and contacts...\n");

  // Get all campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from("outbound_campaigns")
    .select("id, name, status, total_contacts, client_id")
    .order("created_at", { ascending: false })
    .limit(5);

  if (campaignsError) {
    console.error("Error fetching campaigns:", campaignsError);
    return;
  }

  console.log("Recent campaigns:");
  for (const campaign of campaigns) {
    console.log(`\n--- Campaign: ${campaign.name} (${campaign.id}) ---`);
    console.log(`  Status: ${campaign.status}`);
    console.log(`  total_contacts field: ${campaign.total_contacts}`);

    // Count contacts for this campaign
    const { count: actualCount, error: countError } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id);

    if (countError) {
      console.log(`  Error counting contacts: ${countError.message}`);
    } else {
      console.log(`  Actual contact count: ${actualCount}`);
    }

    // Get first 3 contacts with their data
    const { data: contacts, error: contactsError } = await supabase
      .from("campaign_contacts")
      .select("id, phone_number, first_name, last_name, email, status, timezone, custom_data")
      .eq("campaign_id", campaign.id)
      .limit(3);

    if (contactsError) {
      console.log(`  Error fetching contacts: ${contactsError.message}`);
    } else if (contacts && contacts.length > 0) {
      console.log(`  Sample contacts:`);
      for (const contact of contacts) {
        console.log(`    - Phone: ${contact.phone_number}`);
        console.log(`      first_name: "${contact.first_name || ''}" | last_name: "${contact.last_name || ''}"`);
        console.log(`      email: "${contact.email || ''}" | timezone: ${contact.timezone || 'none'}`);
        if (contact.custom_data && Object.keys(contact.custom_data).length > 0) {
          console.log(`      custom_data keys: ${Object.keys(contact.custom_data).join(', ')}`);
        }
      }
    } else {
      console.log(`  No contacts found for this campaign`);
    }

    // Check upload queue
    const { data: queues, error: queueError } = await supabase
      .from("contact_upload_queue")
      .select("id, status, total_contacts, processed_contacts, successful_contacts, failed_contacts")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!queueError && queues && queues.length > 0) {
      const queue = queues[0];
      console.log(`  Upload queue:`);
      console.log(`    Status: ${queue.status}`);
      console.log(`    Total: ${queue.total_contacts}, Processed: ${queue.processed_contacts}`);
      console.log(`    Successful: ${queue.successful_contacts}, Failed: ${queue.failed_contacts}`);
    }
  }
}

checkContacts().catch(console.error);

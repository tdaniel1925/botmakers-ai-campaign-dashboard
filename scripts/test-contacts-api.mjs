import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testContactsApi() {
  // Get the most recent campaign
  const { data: campaigns, error: campaignsError } = await supabase
    .from("outbound_campaigns")
    .select("id, name, total_contacts")
    .order("created_at", { ascending: false })
    .limit(1);

  if (campaignsError || !campaigns || campaigns.length === 0) {
    console.error("Error fetching campaigns:", campaignsError);
    return;
  }

  const campaign = campaigns[0];
  console.log(`Testing campaign: ${campaign.name} (${campaign.id})`);
  console.log(`Campaign total_contacts field: ${campaign.total_contacts}`);

  // Now do the same count query as the API does
  const [
    { count: totalContacts },
    { count: pendingContacts },
    { count: completedContacts },
  ] = await Promise.all([
    supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id),
    supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "pending"),
    supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "completed"),
  ]);

  console.log("\nStats from count queries:");
  console.log(`  totalContacts: ${totalContacts}`);
  console.log(`  pendingContacts: ${pendingContacts}`);
  console.log(`  completedContacts: ${completedContacts}`);
}

testContactsApi().catch(console.error);

#!/usr/bin/env node

/**
 * Fix campaign total_contacts counts
 * This script recalculates and updates the total_contacts field for all campaigns
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCampaignContactCounts() {
  console.log("Fetching all campaigns...");

  const { data: campaigns, error: campaignsError } = await supabase
    .from("outbound_campaigns")
    .select("id, name, total_contacts");

  if (campaignsError) {
    console.error("Error fetching campaigns:", campaignsError);
    process.exit(1);
  }

  console.log(`Found ${campaigns.length} campaigns\n`);

  for (const campaign of campaigns) {
    // Count actual contacts
    const { count, error: countError } = await supabase
      .from("campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id);

    if (countError) {
      console.error(`Error counting contacts for ${campaign.name}:`, countError);
      continue;
    }

    const actualCount = count || 0;
    const storedCount = campaign.total_contacts || 0;

    if (actualCount !== storedCount) {
      console.log(`Campaign "${campaign.name}":`);
      console.log(`  Stored count: ${storedCount.toLocaleString()}`);
      console.log(`  Actual count: ${actualCount.toLocaleString()}`);

      // Update the count
      const { error: updateError } = await supabase
        .from("outbound_campaigns")
        .update({
          total_contacts: actualCount,
          updated_at: new Date().toISOString()
        })
        .eq("id", campaign.id);

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`);
      } else {
        console.log(`  Updated successfully!\n`);
      }
    } else {
      console.log(`Campaign "${campaign.name}": ${actualCount.toLocaleString()} contacts (OK)`);
    }
  }

  console.log("\nDone!");
}

fixCampaignContactCounts();

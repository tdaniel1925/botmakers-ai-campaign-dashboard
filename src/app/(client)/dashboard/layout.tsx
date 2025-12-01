"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { createClient } from "@/lib/supabase/client";
import type { Campaign } from "@/lib/db/schema";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [userName, setUserName] = useState<string>("User");
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        // Get client info
        const { data: client } = await supabase
          .from("clients")
          .select("id, name")
          .eq("email", user.email)
          .single();

        if (client) {
          setUserName(client.name);

          // Get campaigns for this client
          const { data: campaignsData } = await supabase
            .from("campaigns")
            .select("*")
            .eq("client_id", client.id)
            .eq("is_active", true)
            .order("name");

          if (campaignsData) {
            setCampaigns(campaignsData);
          }
        }
      }
    }

    fetchData();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        campaigns={campaigns}
        selectedCampaign={selectedCampaign}
        onCampaignChange={setSelectedCampaign}
        userName={userName}
      />
      <main className="container mx-auto py-6 px-4">{children}</main>
    </div>
  );
}

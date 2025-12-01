"use client";

import { useState, useEffect } from "react";
import { ClientSidebar } from "@/components/dashboard/client-sidebar";
import { createClient } from "@/lib/supabase/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userName, setUserName] = useState<string>("User");
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, name")
          .eq("email", user.email)
          .single();

        if (client) {
          setUserName(client.name);
        }
      }
    }

    fetchData();
  }, [supabase]);

  return (
    <div className="flex h-screen">
      <ClientSidebar userName={userName} />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
        <div className="container mx-auto py-6 px-4">{children}</div>
      </main>
    </div>
  );
}

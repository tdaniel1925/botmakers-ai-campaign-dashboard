"use client";

import { useState, useEffect } from "react";
import { ClientSidebar, MobileMenuButton } from "@/components/dashboard/client-sidebar";
import { createClient } from "@/lib/supabase/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userName, setUserName] = useState<string>("User");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen">
      <ClientSidebar userName={userName} isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background p-4 lg:hidden">
          <MobileMenuButton onClick={toggleSidebar} />
          <span className="font-semibold">Dashboard</span>
        </div>
        <div className="container mx-auto py-6 px-4">{children}</div>
      </main>
    </div>
  );
}

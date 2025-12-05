"use client";

import { useState } from "react";
import { AdminSidebar, AdminMobileMenuButton } from "@/components/admin/admin-sidebar";
import { SessionTimeoutWarning } from "@/components/shared/session-timeout-warning";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen">
      <AdminSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background p-4 lg:hidden">
          <AdminMobileMenuButton onClick={toggleSidebar} />
          <span className="font-semibold">Admin Dashboard</span>
        </div>
        <div className="container mx-auto py-6 px-4">{children}</div>
      </main>
      <SessionTimeoutWarning logoutUrl="/login" />
    </div>
  );
}

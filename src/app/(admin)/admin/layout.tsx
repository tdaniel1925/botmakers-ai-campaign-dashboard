"use client";

import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
        <div className="container mx-auto py-6 px-4">{children}</div>
      </main>
    </div>
  );
}

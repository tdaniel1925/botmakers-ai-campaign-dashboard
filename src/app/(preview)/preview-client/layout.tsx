"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Phone,
  FileBarChart,
  ArrowLeft,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/preview-client",
    icon: LayoutDashboard,
  },
  {
    title: "Calls",
    href: "/preview-client/calls",
    icon: Phone,
  },
  {
    title: "Reports",
    href: "/preview-client/reports",
    icon: FileBarChart,
  },
];

export default function PreviewClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clientName, setClientName] = useState<string>("Client");
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function fetchClientName() {
      const clientId = sessionStorage.getItem("viewAsClientId");
      if (!clientId) return;

      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      if (client) {
        setClientName(client.name);
      }
    }

    fetchClientName();
  }, [supabase]);

  const handleBackToAdmin = () => {
    sessionStorage.removeItem("viewAsClientId");
    window.location.href = "/admin";
  };

  const initials = clientName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="flex h-screen w-64 flex-col border-r bg-background">
        {/* Preview Banner in Sidebar */}
        <div className="bg-amber-100 dark:bg-amber-900 border-b border-amber-300 dark:border-amber-700 px-3 py-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Preview Mode
            </span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 truncate">
            Viewing as: {clientName}
          </p>
        </div>

        <div className="p-4 flex justify-center">
          <div className="w-[90%]">
            <Logo fillWidth={true} />
          </div>
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = item.href === "/preview-client"
                ? pathname === "/preview-client"
                : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-secondary"
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <Separator />
        <div className="p-4 space-y-3">
          {/* User info */}
          <div className="flex items-center space-x-3 px-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              {initials}
            </div>
            <span className="text-sm font-medium truncate">{clientName}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between px-2">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleBackToAdmin}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
        <div className="container mx-auto py-6 px-4">{children}</div>
      </main>
    </div>
  );
}

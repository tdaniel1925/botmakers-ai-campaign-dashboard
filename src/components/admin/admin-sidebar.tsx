"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Webhook,
  Settings,
  Image,
  LogOut,
  Mail,
  FileText,
  Key,
  CreditCard,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewAsClientButton } from "@/components/admin/view-as-client";
import { NotificationBell } from "@/components/notifications/notification-bell";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    href: "/admin/clients",
    icon: Users,
  },
  {
    title: "Campaigns",
    href: "/admin/campaigns",
    icon: Megaphone,
  },
  {
    title: "Webhook Logs",
    href: "/admin/webhook-logs",
    icon: Webhook,
  },
  {
    title: "Email Templates",
    href: "/admin/email-templates",
    icon: Mail,
  },
  {
    title: "Email Logs",
    href: "/admin/email-logs",
    icon: FileText,
  },
  {
    title: "SMS Logs",
    href: "/admin/sms-logs",
    icon: MessageSquare,
  },
  {
    title: "Billing & Plans",
    href: "/admin/billing",
    icon: CreditCard,
  },
];

const settingsItems = [
  {
    title: "API Keys",
    href: "/admin/settings/api-keys",
    icon: Key,
  },
  {
    title: "Logo Upload",
    href: "/admin/settings/logo",
    icon: Image,
  },
  {
    title: "Account",
    href: "/admin/settings/account",
    icon: Settings,
  },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ isOpen = true, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r bg-background transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 flex justify-between items-center">
          <div className="w-[80%]">
            <Logo fillWidth={true} />
          </div>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onToggle}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const isActive = item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={onToggle}>
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
          <Separator className="my-4" />
          <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
            Settings
          </div>
          <nav className="space-y-1">
            {settingsItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={onToggle}>
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
        <div className="p-4 space-y-2">
          <ViewAsClientButton />
          <Separator className="my-2" />
          <div className="flex items-center justify-between px-2">
            <span className="text-sm text-muted-foreground">Theme</span>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );
}

// Mobile menu toggle button component
export function AdminMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden"
      onClick={onClick}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

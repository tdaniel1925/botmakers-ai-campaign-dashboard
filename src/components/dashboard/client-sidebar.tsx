"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  PhoneIncoming,
  PhoneOutgoing,
  FileBarChart,
  LogOut,
  CreditCard,
  Phone,
  Menu,
  X,
  Settings,
  Users,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  Building2,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview & analytics",
  },
];

const campaignNavItems = [
  {
    title: "Inbound",
    href: "/dashboard/inbound",
    icon: PhoneIncoming,
    description: "Incoming call campaigns",
  },
  {
    title: "Outbound",
    href: "/dashboard/outbound",
    icon: PhoneOutgoing,
    description: "AI-powered outbound calls",
  },
  {
    title: "All Calls",
    href: "/dashboard/calls",
    icon: Phone,
    description: "Complete call history",
  },
];

const accountNavItems = [
  {
    title: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    description: "Payments & invoices",
  },
  {
    title: "Team",
    href: "/dashboard/settings/team",
    icon: Users,
    description: "Manage team members",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Account preferences",
  },
];

const supportNavItems = [
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: FileBarChart,
    description: "Analytics & exports",
  },
  {
    title: "Support",
    href: "/dashboard/support",
    icon: MessageSquare,
    description: "Contact us",
  },
  {
    title: "Help Center",
    href: "/dashboard/help",
    icon: HelpCircle,
    description: "Documentation & FAQs",
  },
];

interface ClientSidebarProps {
  userName?: string;
  userEmail?: string;
  companyName?: string;
  userRole?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ClientSidebar({
  userName = "User",
  userEmail = "",
  companyName = "",
  userRole = "owner",
  isOpen = true,
  onToggle
}: ClientSidebarProps) {
  const pathname = usePathname();
  const supabase = createClient();
  const [campaignsOpen, setCampaignsOpen] = useState(true);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const NavItem = ({ item, showDescription = false }: { item: typeof mainNavItems[0], showDescription?: boolean }) => {
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href} onClick={onToggle}>
        <Button
          variant={active ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start h-auto py-2",
            active && "bg-secondary"
          )}
        >
          <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{item.title}</span>
            {showDescription && (
              <span className="text-xs text-muted-foreground">{item.description}</span>
            )}
          </div>
        </Button>
      </Link>
    );
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
        "fixed lg:static inset-y-0 left-0 z-50 flex h-screen w-72 flex-col border-r bg-background transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="p-4 flex justify-between items-center">
          <div className="w-[80%]">
            <Logo fillWidth={true} />
          </div>
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

        {/* Company/Account Switcher */}
        {companyName && (
          <div className="px-3 py-3">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-muted/50">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{companyName}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="space-y-1">
            {/* Main Navigation */}
            {mainNavItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}

            {/* Campaigns Section */}
            <Collapsible open={campaignsOpen} onOpenChange={setCampaignsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-2 mt-2"
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Campaigns
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    campaignsOpen && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {campaignNavItems.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Account Section */}
            <div className="pt-4">
              <p className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account
              </p>
              {accountNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>

            {/* Support Section */}
            <div className="pt-4">
              <p className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Resources
              </p>
              {supportNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          </nav>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="p-3 space-y-3">
          {/* Theme & Notifications */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start h-auto py-2 px-2">
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 ml-3 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/billing">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/support">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Get Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}

// Mobile menu toggle button component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
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

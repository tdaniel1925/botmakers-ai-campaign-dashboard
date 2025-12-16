'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Megaphone,
  Users,
  MessageSquare,
  Mail,
  Settings,
  FileText,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  UserPlus,
  DollarSign,
  FolderOpen,
  Target,
  Package,
  TrendingUp,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface SidebarProps {
  userRole: 'admin' | 'client_user' | 'sales';
  onSignOut: () => void;
}

const adminNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Clients', href: '/admin/clients', icon: Building2 },
  { title: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Interactions', href: '/admin/interactions', icon: MessageSquare },
  { title: 'Sales Team', href: '/admin/sales-team', icon: UserPlus },
  { title: 'All Leads', href: '/admin/leads', icon: Target },
  { title: 'Commissions', href: '/admin/commissions', icon: DollarSign },
  { title: 'Resources', href: '/admin/resources', icon: FolderOpen },
  { title: 'Email Templates', href: '/admin/email-templates', icon: Mail },
  { title: 'Audit Log', href: '/admin/audit-logs', icon: FileText },
  { title: 'Settings', href: '/admin/settings', icon: Settings },
  { title: 'Help', href: '/admin/help', icon: HelpCircle },
];

const clientNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { title: 'Interactions', href: '/dashboard/interactions', icon: MessageSquare },
  { title: 'Account Metrics', href: '/dashboard/metrics', icon: BarChart3 },
  { title: 'Reports', href: '/dashboard/reports', icon: FileText },
  { title: 'Profile', href: '/dashboard/profile', icon: Users },
  { title: 'Help', href: '/dashboard/help', icon: HelpCircle },
];

const salesNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/sales', icon: LayoutDashboard },
  { title: 'My Leads', href: '/sales/leads', icon: UserPlus },
  { title: 'Pipeline', href: '/sales/pipeline', icon: Target },
  { title: 'Commissions', href: '/sales/commissions', icon: DollarSign },
  { title: 'Campaigns', href: '/sales/campaigns', icon: Megaphone },
  { title: 'Resources', href: '/sales/resources', icon: FolderOpen },
  { title: 'Products', href: '/sales/products', icon: Package },
  { title: 'Performance', href: '/sales/performance', icon: TrendingUp },
  { title: 'Profile', href: '/sales/profile', icon: Briefcase },
  { title: 'Help', href: '/sales/help', icon: HelpCircle },
];

export function Sidebar({ userRole, onSignOut }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = userRole === 'admin'
    ? adminNavItems
    : userRole === 'sales'
    ? salesNavItems
    : clientNavItems;

  const homeHref = userRole === 'admin' ? '/admin' : userRole === 'sales' ? '/sales' : '/dashboard';

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href={homeHref} className="flex items-center gap-2">
          {collapsed ? (
            <img
              src="/voicemetrics2.png"
              alt="Logo"
              className="h-8 w-8 object-contain"
            />
          ) : (
            <img
              src="/voicemetrics2.png"
              alt="Logo"
              className="h-10 w-auto object-contain"
            />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full justify-start text-muted-foreground hover:text-foreground',
            collapsed && 'justify-center'
          )}
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-3">Sign Out</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'mt-2 w-full justify-start text-muted-foreground hover:text-foreground',
            collapsed && 'justify-center'
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-3">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

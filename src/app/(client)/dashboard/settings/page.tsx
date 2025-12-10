"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Users,
  CreditCard,
  Bell,
  Shield,
  Key,
  ArrowRight,
} from "lucide-react";

const settingsLinks = [
  {
    title: "Profile",
    description: "Update your personal information and preferences",
    href: "/dashboard/settings/profile",
    icon: User,
  },
  {
    title: "Team Members",
    description: "Manage team access and invite new members",
    href: "/dashboard/settings/team",
    icon: Users,
  },
  {
    title: "Billing & Payments",
    description: "Manage payment methods and view invoices",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    title: "Notifications",
    description: "Configure email and in-app notification preferences",
    href: "/dashboard/settings/notifications",
    icon: Bell,
  },
  {
    title: "Security",
    description: "Password, two-factor authentication, and sessions",
    href: "/dashboard/settings/security",
    icon: Shield,
  },
  {
    title: "API Keys",
    description: "Manage API keys for integrations",
    href: "/dashboard/settings/api-keys",
    icon: Key,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsLinks.map((setting) => (
          <Link key={setting.href} href={setting.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <setting.icon className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{setting.title}</CardTitle>
                <CardDescription>{setting.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

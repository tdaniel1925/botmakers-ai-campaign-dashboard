"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WelcomeModal } from "@/components/shared/welcome-modal";
import { Eye, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function WelcomePreviewPage() {
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState("John");
  const [companyName, setCompanyName] = useState("Acme Corp");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/admin" className="hover:text-foreground transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span>Welcome Message Preview</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome Message Preview</h1>
          <p className="text-muted-foreground">
            Preview the welcome message that new clients see when they first log in
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
      </div>

      {/* Preview Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Preview Settings
          </CardTitle>
          <CardDescription>
            Customize the preview to see how the welcome message appears for different clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="Enter client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The first name shown in the greeting
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Enter company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The company name shown in the title
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={() => setShowModal(true)} size="lg">
              <Eye className="mr-2 h-4 w-4" />
              Preview Welcome Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About the Welcome Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-medium">When it appears</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Shown to new clients on their first login</li>
                <li>- Appears on the client dashboard</li>
                <li>- Only shown if not previously dismissed</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Features</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Overview of platform capabilities</li>
                <li>- Quick start guide steps</li>
                <li>- Links to help resources</li>
                <li>- Option to never show again</li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Dismissal Behavior</h3>
            <p className="text-sm text-muted-foreground">
              When a client clicks &quot;Don&apos;t show this again&quot; and then closes the modal,
              the <code className="bg-muted px-1 rounded">welcome_dismissed_at</code> timestamp
              is saved in the database. The message will not appear on subsequent logins.
            </p>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Re-enabling the Welcome Message</h3>
            <p className="text-sm text-muted-foreground">
              To show the welcome message again for a specific client, set their
              <code className="bg-muted px-1 rounded">welcome_dismissed_at</code> column
              to NULL in the clients table.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Welcome Modal */}
      <WelcomeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onDismissForever={() => setShowModal(false)}
        clientName={clientName || "there"}
        companyName={companyName}
        isPreview={true}
      />
    </div>
  );
}

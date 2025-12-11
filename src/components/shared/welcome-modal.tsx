"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Phone,
  PhoneOutgoing,
  PhoneIncoming,
  BarChart3,
  Users,
  Settings,
  HelpCircle,
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onDismissForever: () => void;
  clientName?: string;
  companyName?: string;
  isPreview?: boolean;
}

const features = [
  {
    icon: PhoneOutgoing,
    title: "Outbound Campaigns",
    description: "Create AI-powered calling campaigns to reach your contacts at scale",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: PhoneIncoming,
    title: "Inbound Campaigns",
    description: "Set up AI assistants to handle incoming calls 24/7",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Track call performance, sentiment analysis, and conversion rates",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Invite team members and manage access permissions",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
];

const quickStartSteps = [
  { step: 1, title: "Set up your first campaign", description: "Create an outbound or inbound campaign" },
  { step: 2, title: "Upload your contacts", description: "Import your contact list via CSV" },
  { step: 3, title: "Configure your AI agent", description: "Customize the voice and script" },
  { step: 4, title: "Launch and monitor", description: "Start calling and track results" },
];

export function WelcomeModal({
  open,
  onClose,
  onDismissForever,
  clientName = "there",
  companyName,
  isPreview = false,
}: WelcomeModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleClose = () => {
    if (dontShowAgain && !isPreview) {
      onDismissForever();
    } else {
      onClose();
    }
  };

  const handleGetStarted = () => {
    if (dontShowAgain && !isPreview) {
      onDismissForever();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl">
            Welcome to the AI Calling Platform{companyName ? `, ${companyName}` : ""}!
          </DialogTitle>
          <DialogDescription className="text-base">
            Hi {clientName}! We&apos;re excited to have you on board. Let&apos;s get you started with a quick overview of what you can do.
          </DialogDescription>
        </DialogHeader>

        {/* Features Grid */}
        <div className="py-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Platform Features
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className={`h-10 w-10 rounded-lg ${feature.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="py-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick Start Guide
          </h3>
          <div className="space-y-2">
            {quickStartSteps.map((item) => (
              <div
                key={item.step}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Help Resources */}
        <div className="py-4 border-t">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Need Help?</p>
                <p className="text-xs text-muted-foreground">
                  Visit our Help Center for guides and tutorials
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/help">
                View Help <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t">
          <div className="flex items-center gap-2 flex-1">
            {!isPreview && (
              <>
                <Checkbox
                  id="dont-show"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <Label
                  htmlFor="dont-show"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Don&apos;t show this again
                </Label>
              </>
            )}
            {isPreview && (
              <span className="text-sm text-muted-foreground italic">
                Preview mode - checkbox disabled
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Skip for now
            </Button>
            <Button onClick={handleGetStarted}>
              <Zap className="mr-2 h-4 w-4" />
              Get Started
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

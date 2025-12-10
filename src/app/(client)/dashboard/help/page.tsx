"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  BookOpen,
  Phone,
  PhoneOutgoing,
  PhoneIncoming,
  CreditCard,
  Users,
  Settings,
  MessageSquare,
  BarChart3,
  ArrowRight,
  HelpCircle,
  Play,
  FileText,
  Zap,
} from "lucide-react";
import { useState } from "react";

const helpCategories = [
  {
    title: "Getting Started",
    description: "Learn the basics of our platform",
    icon: Play,
    articles: [
      { title: "Platform Overview", href: "#" },
      { title: "Setting Up Your First Campaign", href: "#" },
      { title: "Understanding the Dashboard", href: "#" },
      { title: "Managing Your Account", href: "#" },
    ],
  },
  {
    title: "Outbound Campaigns",
    description: "AI-powered outbound calling",
    icon: PhoneOutgoing,
    articles: [
      { title: "Creating an Outbound Campaign", href: "#" },
      { title: "Uploading Contact Lists", href: "#" },
      { title: "Configuring AI Voice Settings", href: "#" },
      { title: "Setting Call Schedules", href: "#" },
      { title: "Understanding Call Outcomes", href: "#" },
    ],
  },
  {
    title: "Inbound Campaigns",
    description: "Handle incoming calls",
    icon: PhoneIncoming,
    articles: [
      { title: "Setting Up Inbound Campaigns", href: "#" },
      { title: "Configuring Webhooks", href: "#" },
      { title: "Call Routing Options", href: "#" },
      { title: "Tracking Inbound Metrics", href: "#" },
    ],
  },
  {
    title: "Billing & Payments",
    description: "Manage your billing",
    icon: CreditCard,
    articles: [
      { title: "Understanding Your Bill", href: "#" },
      { title: "Adding Payment Methods", href: "#" },
      { title: "Viewing Invoice History", href: "#" },
      { title: "Usage and Pricing", href: "#" },
    ],
  },
  {
    title: "Team Management",
    description: "Invite and manage users",
    icon: Users,
    articles: [
      { title: "Inviting Team Members", href: "#" },
      { title: "Role Permissions", href: "#" },
      { title: "Removing Users", href: "#" },
    ],
  },
  {
    title: "Reports & Analytics",
    description: "Understand your data",
    icon: BarChart3,
    articles: [
      { title: "Reading the Dashboard", href: "#" },
      { title: "Exporting Reports", href: "#" },
      { title: "Call Analytics", href: "#" },
      { title: "Sentiment Analysis", href: "#" },
    ],
  },
];

const faqs = [
  {
    question: "How do I create my first outbound campaign?",
    answer: "To create an outbound campaign, navigate to the Outbound section in your dashboard, click 'Create Campaign', and follow the step-by-step wizard. You'll need to provide campaign details, upload your contact list, and configure the AI assistant settings."
  },
  {
    question: "What file formats are supported for contact uploads?",
    answer: "We support CSV and Excel (XLSX) files for contact uploads. Your file should include columns for phone number, first name, and last name at minimum. Additional custom fields can also be included."
  },
  {
    question: "How is billing calculated?",
    answer: "Billing is based on call duration in minutes. Each completed call is billed per minute, rounded up to the nearest minute. You can view detailed usage and pricing on your Billing page."
  },
  {
    question: "Can I pause a running campaign?",
    answer: "Yes, you can pause any active campaign at any time. Navigate to the campaign details page and click the 'Pause' button. You can resume the campaign later to continue calling remaining contacts."
  },
  {
    question: "How do I add team members to my account?",
    answer: "Go to Settings > Team and click 'Invite Member'. Enter their email address and select their role (Manager, Member, or Viewer). They'll receive an email invitation to join your team."
  },
  {
    question: "What happens if a call goes to voicemail?",
    answer: "By default, our AI will leave a voicemail if one is detected. You can configure voicemail behavior in your campaign settings, including the option to skip voicemails entirely."
  },
  {
    question: "How can I track SMS messages sent during campaigns?",
    answer: "SMS messages triggered by campaign rules are logged in the call details. You can view each SMS, its delivery status, and content by clicking on any call in your campaign's call logs."
  },
  {
    question: "What time zones are supported for scheduling?",
    answer: "We support all major US time zones and automatically detect the recipient's timezone based on their area code. This ensures calls are made during appropriate hours."
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-8">
      {/* Header with Search */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Help Center</h1>
        <p className="text-muted-foreground mb-6">
          Find answers, guides, and tutorials to help you get the most out of our platform
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Quick Start Guide</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Get up and running in minutes
                </p>
                <Button variant="link" className="h-auto p-0 text-blue-600">
                  Start Tutorial <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Contact Support</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Get help from our team
                </p>
                <Button variant="link" className="h-auto p-0 text-green-600" asChild>
                  <Link href="/dashboard/support">Open Ticket <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1">API Documentation</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Integrate with our API
                </p>
                <Button variant="link" className="h-auto p-0 text-purple-600">
                  View Docs <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help Categories */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {helpCategories.map((category) => (
            <Card key={category.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <category.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {category.articles.slice(0, 3).map((article) => (
                    <li key={article.title}>
                      <Link
                        href={article.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center"
                      >
                        <BookOpen className="h-3 w-3 mr-2 flex-shrink-0" />
                        {article.title}
                      </Link>
                    </li>
                  ))}
                  {category.articles.length > 3 && (
                    <li>
                      <Button variant="link" className="h-auto p-0 text-sm">
                        View all {category.articles.length} articles
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <Card>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      {faq.question}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pl-7 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Still Need Help */}
      <Card className="bg-muted/50">
        <CardContent className="py-8 text-center">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Can&apos;t find what you&apos;re looking for? Our support team is here to help.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/support">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact Support
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

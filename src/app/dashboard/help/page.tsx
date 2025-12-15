'use client';

import {
  HelpCircle,
  Phone,
  MessageSquare,
  BarChart3,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function ClientHelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Learn how to use your campaign dashboard
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Getting Started
          </CardTitle>
          <CardDescription>
            A quick overview of your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <div>
                <p className="font-medium">View Your Campaigns</p>
                <p className="text-sm text-muted-foreground">
                  Your active campaigns are displayed on the dashboard. Click on any campaign to see its details.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <div>
                <p className="font-medium">Monitor Interactions</p>
                <p className="text-sm text-muted-foreground">
                  Go to Interactions to see all calls, messages, and form submissions from your campaigns.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <div>
                <p className="font-medium">Review Details</p>
                <p className="text-sm text-muted-foreground">
                  Click on any interaction to see the full transcript, AI summary, extracted data, and SMS messages sent.
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Feature Guides */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Guides</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="dashboard">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard Overview
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Your dashboard provides a quick overview of your campaign performance:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Total Interactions</strong> - All calls, messages, and submissions</li>
                  <li><strong>Today&apos;s Activity</strong> - Interactions received today</li>
                  <li><strong>This Week</strong> - Weekly interaction count</li>
                  <li><strong>Completion Rate</strong> - Percentage of successful calls</li>
                </ul>
                <p>
                  Click on any campaign chip to view detailed analytics for that specific campaign.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="interactions">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Viewing Interactions
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Each interaction represents a customer touchpoint. You can view:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>AI Summary</strong> - Quick overview of what happened</li>
                  <li><strong>Full Transcript</strong> - Complete conversation with speaker labels</li>
                  <li><strong>Extracted Data</strong> - Important information pulled from the conversation (names, dates, etc.)</li>
                  <li><strong>Call Recording</strong> - Listen to the original call (if available)</li>
                  <li><strong>SMS Messages</strong> - Any automated messages that were sent</li>
                </ul>
                <p>
                  Use the filters to find specific interactions by status, date range, or search terms.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sms">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS Messages
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Automated SMS messages may be sent to callers based on detected intent.
                  For example, if a caller expresses interest in scheduling, they might
                  receive a confirmation text with booking information.
                </p>
                <p>
                  You can see all SMS messages sent for each interaction in the detail view,
                  including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Message content</li>
                  <li>Delivery status (sent, delivered, or failed)</li>
                  <li>Timestamp</li>
                  <li>Which trigger caused the message</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="export">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Exporting Data
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  You can export your interaction data for reporting or analysis.
                  Contact your administrator if you need access to export functionality.
                </p>
                <p>
                  Exported data includes:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Interaction date and time</li>
                  <li>Phone numbers</li>
                  <li>Call status and duration</li>
                  <li>AI summaries</li>
                  <li>Campaign information</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger className="hover:no-underline text-left">
                Why don&apos;t I see any interactions?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Interactions appear when webhooks are received from your voice AI platform.
                If you don&apos;t see any interactions, the webhook integration may not be
                configured yet. Contact your administrator for assistance.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-2">
              <AccordionTrigger className="hover:no-underline text-left">
                What does &quot;completion rate&quot; mean?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The completion rate shows the percentage of phone calls that were successfully
                completed (answered and the conversation finished normally) versus those that
                failed, went unanswered, or were abandoned.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-3">
              <AccordionTrigger className="hover:no-underline text-left">
                Can I change my password?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes! Click on your profile in the sidebar and select &quot;Settings&quot; to change
                your password. If you forgot your password, use the &quot;Forgot Password&quot; link
                on the login page.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-4">
              <AccordionTrigger className="hover:no-underline text-left">
                How accurate is the AI summary?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                The AI summary is generated automatically based on the call transcript.
                While it&apos;s generally accurate, we recommend reviewing the full transcript
                for important details. The summary is meant to provide a quick overview,
                not replace careful review of the conversation.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-5">
              <AccordionTrigger className="hover:no-underline text-left">
                Why was an SMS sent (or not sent) to a caller?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                SMS messages are sent automatically when the AI detects specific intents
                configured by your administrator. Each trigger can only fire once per phone
                number to prevent duplicate messages. If you have questions about SMS
                configuration, contact your administrator.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            If you have questions or need assistance, please contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import {
  HelpCircle,
  Webhook,
  MessageSquare,
  Users,
  Building2,
  Megaphone,
  Phone,
  Mail,
  BarChart3,
  ScrollText,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Learn how to use the AI Campaign Client Portal
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>
            Get up and running in minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">1</Badge>
              <div>
                <p className="font-medium">Create an Organization</p>
                <p className="text-sm text-muted-foreground">
                  Go to Clients → Add Client to create a new organization for your customer.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">2</Badge>
              <div>
                <p className="font-medium">Set Up a Campaign</p>
                <p className="text-sm text-muted-foreground">
                  Navigate to Campaigns → Add Campaign. Assign it to the organization and configure the webhook URL.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">3</Badge>
              <div>
                <p className="font-medium">Configure Webhook Integration</p>
                <p className="text-sm text-muted-foreground">
                  Copy the unique webhook URL from the campaign and configure it in VAPI, Autocalls.ai, or your voice AI platform.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">4</Badge>
              <div>
                <p className="font-medium">Add SMS Triggers (Optional)</p>
                <p className="text-sm text-muted-foreground">
                  Configure SMS triggers to automatically send messages based on caller intent detected in conversations.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5">5</Badge>
              <div>
                <p className="font-medium">Create Client Users</p>
                <p className="text-sm text-muted-foreground">
                  Go to Users → Add User to create accounts for your client&apos;s team members. They will receive login credentials via email.
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
            <AccordionItem value="webhooks">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Webhook Integration
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Each campaign has a unique webhook URL that accepts POST requests with JSON payloads.
                  The system automatically parses and normalizes data from various sources including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>VAPI</strong> - Voice AI platform webhooks</li>
                  <li><strong>Autocalls.ai</strong> - Outbound calling platform</li>
                  <li><strong>Twilio</strong> - Voice and SMS webhooks</li>
                  <li><strong>Web Forms</strong> - Custom form submissions</li>
                  <li><strong>Chatbots</strong> - Chat platform webhooks</li>
                </ul>
                <p>
                  The AI automatically extracts phone numbers, transcripts, call status, duration,
                  and generates summaries. You can configure extraction hints in the campaign settings
                  to help the AI locate specific fields in unusual payload structures.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sms-triggers">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS Triggers
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  SMS triggers allow you to automatically send text messages based on caller intent.
                  When a webhook is received, the AI analyzes the transcript and summary against
                  your configured intent descriptions.
                </p>
                <p><strong>How it works:</strong></p>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Define an intent description (e.g., &quot;Caller expressed interest in scheduling&quot;)</li>
                  <li>Write the SMS message to send when this intent is detected</li>
                  <li>Set a priority (lower = evaluated first)</li>
                  <li>The AI evaluates each trigger and sends matching SMS messages</li>
                </ol>
                <p>
                  <strong>Note:</strong> Each trigger can only fire once per phone number per campaign
                  to prevent duplicate messages.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="users">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  User Management
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  There are two types of users in the system:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Admin Users</strong> - Full access to manage all organizations, campaigns,
                    users, and settings. Can view all data across all organizations.
                  </li>
                  <li>
                    <strong>Client Users</strong> - Limited access to view their organization&apos;s
                    campaigns and interactions. Cannot manage other organizations or settings.
                  </li>
                </ul>
                <p>
                  When creating users, you can choose to send login credentials via email or
                  display them on screen. Users are required to change their password on first login.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="interactions">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Interactions
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Every webhook received creates an interaction record containing:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Phone number and caller information</li>
                  <li>Call transcript (formatted and raw)</li>
                  <li>AI-generated summary</li>
                  <li>Extracted data (appointment dates, names, etc.)</li>
                  <li>Call status and duration</li>
                  <li>Recording URL (if available)</li>
                  <li>SMS messages sent</li>
                  <li>Raw webhook payload</li>
                </ul>
                <p>
                  You can flag interactions for review and filter by various criteria including
                  date range, status, source type, and campaign.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="reports">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reports & Export
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  The reports page provides analytics including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Total interactions and completion rates</li>
                  <li>Average call duration</li>
                  <li>SMS delivery statistics</li>
                  <li>Status breakdown charts</li>
                  <li>Source breakdown charts</li>
                  <li>Daily trend visualization</li>
                </ul>
                <p>
                  You can export interaction data in CSV or JSON format for further analysis
                  or integration with other tools.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="email-templates">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Templates
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Customize the email templates used for system notifications:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Credentials</strong> - Sent to new users with login information</li>
                  <li><strong>Welcome</strong> - Welcome message after first login</li>
                  <li><strong>Password Reset</strong> - Password reset instructions</li>
                  <li><strong>Scheduled Report</strong> - Automated report emails</li>
                </ul>
                <p>
                  Templates support variables like <code className="bg-muted px-1 rounded">{'{{name}}'}</code>,
                  <code className="bg-muted px-1 rounded">{'{{email}}'}</code>, etc. Set one template as
                  default for each type.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Webhook Payload Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Payload Examples</CardTitle>
          <CardDescription>
            Example JSON payloads from common integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium mb-2">VAPI Webhook</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "message": {
    "type": "end-of-call-report",
    "call": {
      "id": "call_123",
      "status": "completed",
      "customer": {
        "number": "+15551234567"
      }
    },
    "transcript": "...",
    "summary": "Customer called to schedule appointment"
  }
}`}
            </pre>
          </div>

          <div>
            <p className="font-medium mb-2">Twilio Voice Webhook</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "CallSid": "CA123...",
  "From": "+15551234567",
  "To": "+15559876543",
  "CallStatus": "completed",
  "CallDuration": "120"
}`}
            </pre>
          </div>

          <div>
            <p className="font-medium mb-2">Autocalls.ai Webhook</p>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "call_id": "abc123",
  "phone": "+15551234567",
  "status": "completed",
  "duration_seconds": 120,
  "transcript": "...",
  "summary": "..."
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Required Environment Variables</CardTitle>
          <CardDescription>
            Configuration required for the application to function
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                NEXT_PUBLIC_SUPABASE_URL
              </code>
              <span className="text-sm text-muted-foreground">Your Supabase project URL</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>
              <span className="text-sm text-muted-foreground">Supabase anonymous key</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                SUPABASE_SERVICE_ROLE_KEY
              </code>
              <span className="text-sm text-muted-foreground">Supabase service role key (server-side only)</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                DATABASE_URL
              </code>
              <span className="text-sm text-muted-foreground">PostgreSQL connection string</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                OPENAI_API_KEY
              </code>
              <span className="text-sm text-muted-foreground">OpenAI API key for AI processing</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                TWILIO_ACCOUNT_SID
              </code>
              <span className="text-sm text-muted-foreground">Twilio account SID for SMS</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                TWILIO_AUTH_TOKEN
              </code>
              <span className="text-sm text-muted-foreground">Twilio auth token</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                TWILIO_PHONE_NUMBER
              </code>
              <span className="text-sm text-muted-foreground">Default Twilio phone number for SMS</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono min-w-[280px]">
                RESEND_API_KEY
              </code>
              <span className="text-sm text-muted-foreground">Resend API key for email (optional)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            If you have questions or need assistance, contact your system administrator
            or reach out to support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

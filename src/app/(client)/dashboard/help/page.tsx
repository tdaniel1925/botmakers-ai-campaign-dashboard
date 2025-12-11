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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  BookOpen,
  PhoneOutgoing,
  PhoneIncoming,
  CreditCard,
  Users,
  MessageSquare,
  BarChart3,
  ArrowRight,
  HelpCircle,
  Play,
  FileText,
  Zap,
  Clock,
  CheckCircle2,
  Lightbulb,
  Video,
  ChevronRight,
  Headphones,
} from "lucide-react";
import { useState, useMemo } from "react";

// Comprehensive help categories with detailed articles
const helpCategories = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of our AI calling platform",
    icon: Play,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    articles: [
      {
        id: "platform-overview",
        title: "Platform Overview",
        description: "Understand the core features and capabilities of the platform",
        content: `
## Welcome to the AI Calling Platform

Our platform enables you to create intelligent, automated calling campaigns that scale your outreach while maintaining personalized conversations.

### Key Features

- **AI-Powered Conversations**: Natural language understanding for dynamic call handling
- **Outbound Campaigns**: Automated calling to your contact lists
- **Inbound Handling**: 24/7 AI assistants for incoming calls
- **Real-time Analytics**: Track performance and optimize campaigns
- **Team Collaboration**: Invite team members with role-based access

### Navigation

- **Dashboard**: Your command center for quick stats and recent activity
- **Outbound**: Create and manage outbound calling campaigns
- **Inbound**: Configure AI assistants for incoming calls
- **Reports**: Detailed analytics and exportable reports
- **Settings**: Account configuration and team management

### Getting Help

Need assistance? Our support team is here to help:
- Visit the Help Center (you're here!)
- Open a support ticket
- Check our FAQ section below
        `,
        tags: ["basics", "features", "navigation"],
      },
      {
        id: "first-campaign",
        title: "Setting Up Your First Campaign",
        description: "Step-by-step guide to launching your first outbound campaign",
        content: `
## Creating Your First Outbound Campaign

Follow these steps to launch your first AI-powered calling campaign.

### Step 1: Navigate to Outbound Campaigns

Click on "Outbound" in the sidebar, then click "Create Campaign".

### Step 2: Configure Basic Settings

- **Campaign Name**: Choose a descriptive name
- **Description**: Add notes about the campaign purpose
- **Provider**: Select your calling provider (VAPI or Bland)

### Step 3: Upload Your Contacts

- Prepare a CSV file with columns: phone_number, first_name, last_name
- Additional columns can be used as custom variables
- Our system auto-detects common column names

### Step 4: Configure the AI Assistant

- Select or create a voice for your AI
- Define the conversation script or objectives
- Set up any custom variables for personalization

### Step 5: Set Calling Schedule

- Choose calling hours (we respect timezone differences)
- Set maximum attempts per contact
- Configure retry logic

### Step 6: Review and Launch

- Preview your settings
- Start with a test call to verify everything works
- Launch the campaign when ready

### Tips for Success

- Start with a small batch to test your script
- Monitor initial calls for quality
- Adjust based on early feedback
        `,
        tags: ["campaign", "outbound", "setup", "tutorial"],
      },
      {
        id: "dashboard-guide",
        title: "Understanding the Dashboard",
        description: "Learn how to read and use your dashboard effectively",
        content: `
## Your Dashboard Explained

The dashboard provides a real-time overview of your calling activity.

### Key Metrics

- **Total Calls**: All calls made across campaigns
- **Completed**: Successful connections
- **Transferred**: Calls handed off to humans
- **Success Rate**: Percentage of positive outcomes

### Call Volume Chart

The chart shows call activity over time:
- Daily, weekly, or monthly views available
- Hover for detailed breakdowns
- Compare performance periods

### Recent Activity

View your latest calls with quick access to:
- Call recordings
- Transcripts
- Outcome details

### Quick Actions

From the dashboard, you can:
- Create new campaigns
- View detailed reports
- Access recent calls
- Check pending contacts
        `,
        tags: ["dashboard", "metrics", "analytics"],
      },
      {
        id: "account-setup",
        title: "Managing Your Account",
        description: "Configure your account settings and preferences",
        content: `
## Account Settings

Customize your experience and manage your account.

### Profile Settings

- Update your name and contact information
- Change your password
- Set notification preferences

### Company Settings

- Update company name and branding
- Configure timezone settings
- Set default calling hours

### Security

- Enable two-factor authentication
- View login history
- Manage API keys

### Notification Preferences

Choose how you want to be notified:
- Email alerts for campaign completion
- Daily/weekly summary reports
- Real-time alerts for important events
        `,
        tags: ["account", "settings", "security", "profile"],
      },
    ],
  },
  {
    id: "outbound-campaigns",
    title: "Outbound Campaigns",
    description: "Master AI-powered outbound calling",
    icon: PhoneOutgoing,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    articles: [
      {
        id: "creating-campaign",
        title: "Creating an Outbound Campaign",
        description: "Detailed guide to campaign creation",
        content: `
## Campaign Creation Guide

### Campaign Types

1. **Standard Campaign**: Fixed script with variable personalization
2. **Dynamic Campaign**: AI adapts based on conversation flow
3. **Survey Campaign**: Collect structured responses

### Configuration Options

**Basic Settings**
- Campaign name and description
- Target completion date
- Priority level

**Calling Rules**
- Max attempts per contact
- Time between attempts
- Voicemail handling

**AI Configuration**
- Voice selection
- Conversation objectives
- Fallback responses

### Best Practices

- Keep initial messages concise
- Personalize when possible
- Set clear success criteria
- Monitor and iterate
        `,
        tags: ["campaign", "creation", "configuration"],
      },
      {
        id: "contact-uploads",
        title: "Uploading Contact Lists",
        description: "How to import and manage your contacts",
        content: `
## Contact Upload Guide

### Supported Formats

- CSV (Comma-Separated Values)
- Excel files (.xlsx)

### Required Columns

| Column | Description | Required |
|--------|-------------|----------|
| phone_number | Contact phone number | Yes |
| first_name | Contact's first name | Recommended |
| last_name | Contact's last name | Recommended |

### Optional Columns

- **email**: For follow-up communications
- **timezone**: Override auto-detection
- **company**: Business name
- **custom fields**: Any additional data

### Phone Number Formats

We accept various formats:
- (555) 123-4567
- 555-123-4567
- 5551234567
- +15551234567

All numbers are normalized to E.164 format.

### Handling Duplicates

Duplicate phone numbers within the same campaign are automatically:
- Detected during upload
- Skipped (not duplicated)
- Counted in the upload summary

### Large Uploads

For lists over 10,000 contacts:
- Upload in chunks of 5,000-10,000
- Monitor progress in the UI
- Wait for completion before uploading more
        `,
        tags: ["contacts", "upload", "csv", "import"],
      },
      {
        id: "ai-voice-settings",
        title: "Configuring AI Voice Settings",
        description: "Customize your AI assistant's voice and personality",
        content: `
## AI Voice Configuration

### Voice Selection

Choose from multiple voice options:
- **Professional Male/Female**: Business-appropriate tones
- **Friendly Casual**: Warmer, conversational style
- **Custom Voices**: Enterprise clients can use custom voices

### Speech Settings

**Speaking Rate**
- Adjust speed from slow to fast
- Consider your audience

**Pitch**
- Higher or lower vocal pitch
- Match your brand personality

**Emphasis**
- Enable dynamic emphasis
- More natural conversations

### Personality Configuration

**Tone Options**
- Professional
- Friendly
- Enthusiastic
- Calm and Reassuring

**Conversation Style**
- Direct and efficient
- Conversational and engaging
- Formal and polished

### Testing Your Configuration

Always test your voice settings:
1. Use the "Test Call" feature
2. Call yourself to hear the AI
3. Adjust based on feedback
        `,
        tags: ["voice", "ai", "configuration", "personality"],
      },
      {
        id: "call-scheduling",
        title: "Setting Call Schedules",
        description: "Configure when your campaigns make calls",
        content: `
## Call Scheduling

### Timezone Handling

Our platform automatically:
- Detects timezone from area codes (US numbers)
- Respects local calling hours
- Adjusts for daylight saving time

### Calling Windows

Set allowed calling hours:
- Start time (e.g., 9:00 AM)
- End time (e.g., 6:00 PM)
- Days of the week

### Best Times to Call

Based on industry data:
- **B2B**: Tuesday-Thursday, 10-11 AM
- **B2C**: Evenings 5-8 PM, Saturdays
- **Healthcare**: Mid-morning, early afternoon

### Throttling Options

Control call pacing:
- Maximum concurrent calls
- Calls per hour limit
- Cool-down periods

### Priority Scheduling

For time-sensitive campaigns:
- Set priority levels
- Earlier contacts called first
- Override default scheduling
        `,
        tags: ["scheduling", "timezone", "hours", "pacing"],
      },
      {
        id: "call-outcomes",
        title: "Understanding Call Outcomes",
        description: "Learn about different call result types",
        content: `
## Call Outcomes Explained

### Primary Outcomes

**Completed**
- Call connected and conversation happened
- AI achieved conversation objectives

**No Answer**
- Phone rang but wasn't answered
- Can be retried based on settings

**Voicemail**
- Reached voicemail system
- Message may be left (configurable)

**Busy**
- Line was busy
- Automatic retry scheduled

**Failed**
- Technical issue prevented call
- Network or provider error

### Secondary Outcomes

After a completed call, track:
- **Interested**: Positive response
- **Not Interested**: Clear decline
- **Callback Requested**: Wants follow-up
- **Wrong Number**: Update contact info
- **Do Not Call**: Add to suppression

### Using Outcomes

Filter and segment contacts by outcome:
- Export lists by outcome type
- Create follow-up campaigns
- Measure campaign effectiveness
        `,
        tags: ["outcomes", "results", "status", "tracking"],
      },
    ],
  },
  {
    id: "inbound-campaigns",
    title: "Inbound Campaigns",
    description: "Handle incoming calls with AI",
    icon: PhoneIncoming,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    articles: [
      {
        id: "inbound-setup",
        title: "Setting Up Inbound Campaigns",
        description: "Configure AI to handle incoming calls",
        content: `
## Inbound Campaign Setup

### Overview

Inbound campaigns let your AI assistant handle incoming calls 24/7.

### Requirements

- A dedicated phone number
- Configured AI assistant
- Defined conversation flows

### Setup Steps

1. **Create Inbound Campaign**
   - Navigate to Inbound section
   - Click "Create Campaign"

2. **Assign Phone Number**
   - Purchase or port a number
   - Link to campaign

3. **Configure AI Assistant**
   - Set greeting message
   - Define available actions
   - Configure business hours

4. **Set Up Call Routing**
   - Define when to transfer
   - Configure fallback behavior
   - Set up voicemail

5. **Test Thoroughly**
   - Call the number yourself
   - Test various scenarios
   - Verify transfers work
        `,
        tags: ["inbound", "setup", "incoming", "configuration"],
      },
      {
        id: "webhooks",
        title: "Configuring Webhooks",
        description: "Integrate with external systems",
        content: `
## Webhook Configuration

### What Are Webhooks?

Webhooks send real-time notifications to your systems when events occur.

### Available Events

- **call.started**: Call begins
- **call.ended**: Call completes
- **call.transferred**: Handed to human
- **voicemail.left**: Message recorded

### Setup Process

1. Provide your endpoint URL
2. Select events to receive
3. Configure authentication
4. Test the connection

### Security

- Use HTTPS endpoints
- Validate webhook signatures
- Implement retry handling
        `,
        tags: ["webhooks", "integration", "api", "automation"],
      },
      {
        id: "call-routing",
        title: "Call Routing Options",
        description: "Direct calls to the right destination",
        content: `
## Call Routing

### Routing Types

**Time-Based Routing**
- Business hours vs after hours
- Holiday schedules
- Weekend handling

**Intent-Based Routing**
- Route by caller request
- Department selection
- Priority queuing

**Skill-Based Routing**
- Match to qualified agents
- Language preferences
- Expertise areas

### Transfer Options

**Warm Transfer**
- AI briefs human agent
- Smooth handoff
- Context preserved

**Cold Transfer**
- Direct connect
- Faster transfer
- Less context

**Voicemail**
- Leave message option
- Email notification
- Callback scheduling

### Fallback Handling

When routing fails:
- Retry logic
- Alternative destinations
- Graceful error messages
        `,
        tags: ["routing", "transfer", "ivr", "queuing"],
      },
      {
        id: "inbound-metrics",
        title: "Tracking Inbound Metrics",
        description: "Monitor inbound campaign performance",
        content: `
## Inbound Analytics

### Key Metrics

**Call Volume**
- Total incoming calls
- Calls by hour/day
- Peak times

**Handle Time**
- Average call duration
- Resolution time
- Hold time

**Resolution Rates**
- AI-resolved calls
- Transferred calls
- Abandoned calls

### Performance Indicators

- **First Call Resolution**: Issues solved without callback
- **Customer Satisfaction**: Post-call ratings
- **Transfer Rate**: Calls needing human help

### Using Analytics

- Identify peak hours for staffing
- Improve AI responses
- Track trends over time
- Compare periods

### Reporting

- Scheduled email reports
- Real-time dashboards
- Custom date ranges
- Export to CSV/Excel
        `,
        tags: ["analytics", "metrics", "reporting", "performance"],
      },
    ],
  },
  {
    id: "billing",
    title: "Billing & Payments",
    description: "Manage your billing and payments",
    icon: CreditCard,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    articles: [
      {
        id: "understanding-billing",
        title: "Understanding Your Bill",
        description: "How billing works on our platform",
        content: `
## Billing Overview

### Pricing Model

We use usage-based pricing:
- Charged per minute of call time
- Rounded to nearest second
- Monthly billing cycle

### Usage Components

**Call Minutes**
- Outbound and inbound calls
- All connected time counts
- Voicemail time included

**Add-on Charges**
- SMS messages (if enabled)
- Premium voices
- Additional phone numbers

### Viewing Your Usage

Access your billing dashboard to see:
- Current period usage
- Historical usage
- Projected costs

### Billing Cycle

- Bills generated monthly
- Payment due within 15 days
- Auto-pay available
        `,
        tags: ["billing", "pricing", "usage", "costs"],
      },
      {
        id: "payment-methods",
        title: "Adding Payment Methods",
        description: "Set up your payment information",
        content: `
## Payment Methods

### Accepted Methods

- Credit/Debit Cards (Visa, Mastercard, Amex)
- ACH Bank Transfer
- Wire Transfer (Enterprise)

### Adding a Card

1. Go to Settings > Billing
2. Click "Add Payment Method"
3. Enter card details
4. Verify the card

### Setting Default Payment

- Mark any method as default
- Default used for auto-pay
- Can change anytime

### Security

- PCI DSS compliant
- Encrypted storage
- Tokenized transactions
        `,
        tags: ["payment", "credit card", "billing", "setup"],
      },
      {
        id: "invoices",
        title: "Viewing Invoice History",
        description: "Access and download past invoices",
        content: `
## Invoice Management

### Accessing Invoices

Navigate to Settings > Billing > Invoices

### Invoice Details

Each invoice includes:
- Billing period
- Usage breakdown
- Line item details
- Payment status

### Downloading Invoices

- PDF format available
- Bulk download option
- Email delivery option

### Invoice Status

- **Paid**: Payment received
- **Pending**: Awaiting payment
- **Overdue**: Past due date
- **Disputed**: Under review
        `,
        tags: ["invoices", "history", "receipts", "billing"],
      },
      {
        id: "usage-pricing",
        title: "Usage and Pricing Details",
        description: "Detailed pricing information",
        content: `
## Pricing Details

### Standard Rates

| Feature | Rate |
|---------|------|
| Outbound Calls | $0.05/min |
| Inbound Calls | $0.04/min |
| SMS Messages | $0.01/message |
| Phone Numbers | $2/month |

### Volume Discounts

| Monthly Minutes | Discount |
|-----------------|----------|
| 10,000+ | 10% |
| 50,000+ | 20% |
| 100,000+ | 30% |

### Enterprise Pricing

Contact us for:
- Custom rates
- Committed use discounts
- Dedicated support
- SLA guarantees

### Cost Optimization

- Review unused phone numbers
- Optimize call scripts for efficiency
- Use scheduling to avoid off-hours
- Monitor and optimize campaigns
        `,
        tags: ["pricing", "rates", "discounts", "costs"],
      },
    ],
  },
  {
    id: "team-management",
    title: "Team Management",
    description: "Invite and manage team members",
    icon: Users,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    articles: [
      {
        id: "inviting-members",
        title: "Inviting Team Members",
        description: "Add new users to your organization",
        content: `
## Adding Team Members

### Invitation Process

1. Go to Settings > Team
2. Click "Invite Member"
3. Enter email address
4. Select role
5. Send invitation

### Invitation Email

Recipients receive:
- Welcome message
- Account setup link
- Role information
- Getting started guide

### Pending Invitations

- View pending invites
- Resend if needed
- Revoke unused invitations

### Bulk Invitations

For multiple users:
- Use CSV upload
- Specify roles per user
- Track invitation status
        `,
        tags: ["team", "invite", "users", "members"],
      },
      {
        id: "role-permissions",
        title: "Role Permissions",
        description: "Understand user roles and access levels",
        content: `
## User Roles

### Available Roles

**Owner**
- Full account access
- Billing management
- User management
- All campaign controls

**Manager**
- Create/edit campaigns
- View all reports
- Cannot manage billing
- Cannot remove owner

**Member**
- View campaigns
- Make test calls
- Limited editing
- No user management

**Viewer**
- Read-only access
- View reports
- No editing capabilities

### Custom Permissions

Enterprise accounts can:
- Create custom roles
- Fine-tune permissions
- Set department access

### Changing Roles

- Owners can change any role
- Changes take effect immediately
- Audit log records changes
        `,
        tags: ["roles", "permissions", "access", "security"],
      },
      {
        id: "removing-users",
        title: "Removing Users",
        description: "How to remove team members",
        content: `
## Removing Team Members

### Removal Process

1. Go to Settings > Team
2. Find the user
3. Click "Remove"
4. Confirm removal

### What Happens

- Immediate access revocation
- Sessions terminated
- Activity logged
- Data preserved

### Considerations

Before removing:
- Reassign owned campaigns
- Transfer responsibilities
- Document handover

### Reactivation

Removed users can be:
- Re-invited later
- Given new roles
- Historical data accessible
        `,
        tags: ["remove", "users", "deactivate", "team"],
      },
    ],
  },
  {
    id: "reports-analytics",
    title: "Reports & Analytics",
    description: "Understand your data",
    icon: BarChart3,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    articles: [
      {
        id: "dashboard-reading",
        title: "Reading the Dashboard",
        description: "Interpret dashboard metrics correctly",
        content: `
## Dashboard Metrics

### Overview Cards

**Total Calls**
- Sum of all call attempts
- Includes all outcomes

**Completed Calls**
- Successfully connected
- Conversation happened

**Transfer Rate**
- Calls transferred to humans
- Lower is usually better

**Success Rate**
- Positive outcomes / Total
- Your key performance indicator

### Charts

**Call Volume Over Time**
- Daily/weekly/monthly views
- Trend lines
- Comparison periods

**Outcome Distribution**
- Pie chart of results
- Quick health check

### Filters

Narrow your view by:
- Date range
- Campaign
- Outcome type
- Team member
        `,
        tags: ["dashboard", "metrics", "overview", "kpis"],
      },
      {
        id: "exporting-reports",
        title: "Exporting Reports",
        description: "Download data for external analysis",
        content: `
## Report Exports

### Available Exports

- **Call Detail Records**: Complete call data
- **Campaign Summary**: High-level stats
- **Contact List**: Updated contact status
- **Transcript Export**: All conversation transcripts

### Export Formats

- CSV (spreadsheet compatible)
- Excel (.xlsx)
- JSON (for developers)
- PDF (for presentations)

### Scheduling Reports

Set up automatic exports:
- Daily, weekly, or monthly
- Email delivery
- Cloud storage upload

### Custom Reports

Enterprise features:
- Custom columns
- Filtered datasets
- Aggregated views
        `,
        tags: ["export", "reports", "download", "data"],
      },
      {
        id: "call-analytics",
        title: "Call Analytics Deep Dive",
        description: "Advanced call performance analysis",
        content: `
## Advanced Analytics

### Call Quality Metrics

**Average Handle Time**
- Conversation duration
- Benchmark against goals

**Talk Ratio**
- AI vs caller speaking time
- Ideal: 40-60% caller

**Silence Percentage**
- Dead air in calls
- Lower is better

### Conversion Analysis

Track by:
- Time of day
- Day of week
- Contact source
- Geographic region

### A/B Testing

Compare:
- Different scripts
- Voice variations
- Call times
- Approaches

### Trend Analysis

Monitor over time:
- Performance improvements
- Seasonal patterns
- Issue detection
        `,
        tags: ["analytics", "performance", "quality", "trends"],
      },
      {
        id: "sentiment-analysis",
        title: "Sentiment Analysis",
        description: "Understand caller emotions and satisfaction",
        content: `
## Sentiment Analysis

### What We Measure

**Positive Indicators**
- Enthusiastic responses
- Agreement signals
- Appreciation expressions

**Negative Indicators**
- Frustration cues
- Disagreement
- Request to end call

**Neutral**
- Informational responses
- Standard acknowledgments

### Using Sentiment Data

- Identify training opportunities
- Improve scripts
- Detect issues early
- Measure satisfaction

### Sentiment Reports

- Per-call sentiment scores
- Campaign averages
- Trend over time
- Comparison views

### Best Practices

- Monitor low scores
- Celebrate high performers
- Iterate based on feedback
- Train AI on positive patterns
        `,
        tags: ["sentiment", "emotion", "satisfaction", "nps"],
      },
    ],
  },
];

// Comprehensive FAQs
const faqs = [
  {
    category: "Getting Started",
    questions: [
      {
        question: "How do I create my first outbound campaign?",
        answer: "Navigate to the Outbound section in your dashboard, click 'Create Campaign', and follow the step-by-step wizard. You'll need to provide campaign details, upload your contact list, and configure the AI assistant settings. We recommend starting with a small test batch to verify your setup."
      },
      {
        question: "What's the difference between outbound and inbound campaigns?",
        answer: "Outbound campaigns initiate calls to your contact list - you're reaching out to people. Inbound campaigns handle calls that come TO you - customers calling your business phone number. Both use AI to manage conversations, but they serve different purposes."
      },
      {
        question: "How long does it take to set up my first campaign?",
        answer: "A basic campaign can be set up in 15-20 minutes. This includes uploading contacts, configuring the AI, and launching. More complex campaigns with custom scripts and integrations may take longer to configure properly."
      },
    ],
  },
  {
    category: "Contacts & Uploads",
    questions: [
      {
        question: "What file formats are supported for contact uploads?",
        answer: "We support CSV and Excel (XLSX) files. Your file should include a column for phone number at minimum. First name and last name columns are recommended for personalization. Additional custom fields can be included and used as variables in your scripts."
      },
      {
        question: "How are duplicate contacts handled?",
        answer: "When you upload contacts, our system automatically detects duplicates within the same campaign using phone numbers. Duplicate entries are skipped and reported in the upload summary. Across different campaigns, contacts are treated independently."
      },
      {
        question: "What's the maximum number of contacts I can upload?",
        answer: "There's no hard limit on contacts. However, for optimal performance, we recommend uploading in batches of 10,000 or fewer. For very large lists, consider breaking them into multiple campaigns or uploading in chunks."
      },
      {
        question: "How do I handle international phone numbers?",
        answer: "International numbers are supported. Include the country code (e.g., +44 for UK). Our system will detect and properly format international numbers. Note that international calling may have different rates and compliance requirements."
      },
    ],
  },
  {
    category: "Calling & AI",
    questions: [
      {
        question: "Can I pause a running campaign?",
        answer: "Yes, you can pause any active campaign at any time. Navigate to the campaign details page and click the 'Pause' button. Pausing immediately stops new calls from being initiated. You can resume the campaign later to continue calling remaining contacts."
      },
      {
        question: "What happens if a call goes to voicemail?",
        answer: "By default, our AI will detect voicemail and can leave a message if configured. In campaign settings, you can choose to: leave a voicemail with your script, hang up immediately, or retry later. Voicemail detection is highly accurate but not 100%."
      },
      {
        question: "How does timezone detection work?",
        answer: "For US phone numbers, we automatically detect the timezone based on the area code. This ensures calls are made during appropriate hours in the recipient's local time. For international numbers or when you want to override, you can specify timezone in your contact upload."
      },
      {
        question: "Can the AI handle complex conversations?",
        answer: "Yes, our AI uses advanced natural language understanding to handle dynamic conversations. It can answer questions, handle objections, and adapt based on caller responses. However, for very complex or sensitive topics, you can configure the AI to transfer to a human agent."
      },
    ],
  },
  {
    category: "Billing & Pricing",
    questions: [
      {
        question: "How is billing calculated?",
        answer: "Billing is based on call duration measured in minutes. We round to the nearest second and bill at the end of each monthly cycle. Connected time (from answer to hangup) is what counts - unanswered calls and busy signals are not billed."
      },
      {
        question: "Are there volume discounts available?",
        answer: "Yes, we offer volume discounts for higher usage. Accounts using 10,000+ minutes monthly receive 10% off, 50,000+ minutes get 20% off, and 100,000+ minutes receive 30% off. Enterprise clients can negotiate custom rates."
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept major credit cards (Visa, Mastercard, American Express), ACH bank transfers, and wire transfers for enterprise accounts. All payments are processed securely through our PCI-compliant payment system."
      },
    ],
  },
  {
    category: "Team & Security",
    questions: [
      {
        question: "How do I add team members to my account?",
        answer: "Go to Settings > Team and click 'Invite Member'. Enter their email address and select their role (Manager, Member, or Viewer). They'll receive an email invitation to join your team with instructions to set up their account."
      },
      {
        question: "What's the difference between user roles?",
        answer: "Owners have full access including billing. Managers can create and edit campaigns but not manage billing. Members have limited editing capabilities. Viewers have read-only access. Choose roles based on what each team member needs to do their job."
      },
      {
        question: "Is my data secure?",
        answer: "Yes, we take security seriously. All data is encrypted in transit (TLS) and at rest. We're SOC 2 Type II compliant, and recordings are stored securely with access controls. We never sell or share your data with third parties."
      },
    ],
  },
  {
    category: "Technical & Integration",
    questions: [
      {
        question: "Do you have an API?",
        answer: "Yes, we offer a REST API for programmatic access to most platform features. You can create campaigns, upload contacts, retrieve call data, and more. API documentation is available in your account settings under API Keys."
      },
      {
        question: "Can I integrate with my CRM?",
        answer: "Yes, we support integration with popular CRMs like Salesforce, HubSpot, and others through our API and webhooks. Webhook events can notify your systems in real-time when calls complete, allowing you to update your CRM automatically."
      },
      {
        question: "How can I track SMS messages sent during campaigns?",
        answer: "SMS messages triggered by campaign rules are logged in the call details. Navigate to any call in your campaign's call logs and you'll see any SMS messages associated with that call, including delivery status and content."
      },
    ],
  },
];

// Video tutorials data
const videoTutorials = [
  {
    id: "quick-start",
    title: "Quick Start Guide",
    duration: "5:30",
    description: "Get up and running in under 6 minutes",
  },
  {
    id: "campaign-creation",
    title: "Creating Your First Campaign",
    duration: "8:45",
    description: "Step-by-step campaign creation walkthrough",
  },
  {
    id: "contact-management",
    title: "Contact Upload & Management",
    duration: "6:20",
    description: "Master contact uploads and data management",
  },
  {
    id: "ai-configuration",
    title: "Configuring Your AI Assistant",
    duration: "10:15",
    description: "Customize voice, personality, and scripts",
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  // Filter articles based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return helpCategories;

    const query = searchQuery.toLowerCase();
    return helpCategories
      .map((category) => ({
        ...category,
        articles: category.articles.filter(
          (article) =>
            article.title.toLowerCase().includes(query) ||
            article.description.toLowerCase().includes(query) ||
            article.tags.some((tag) => tag.toLowerCase().includes(query))
        ),
      }))
      .filter((category) => category.articles.length > 0);
  }, [searchQuery]);

  // Find selected article details
  const selectedArticleData = useMemo(() => {
    if (!selectedArticle) return null;
    for (const category of helpCategories) {
      const article = category.articles.find((a) => a.id === selectedArticle);
      if (article) return { ...article, category };
    }
    return null;
  }, [selectedArticle]);

  // If viewing a specific article
  if (selectedArticleData) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => setSelectedArticle(null)}
            className="hover:text-foreground transition-colors"
          >
            Help Center
          </button>
          <ChevronRight className="h-4 w-4" />
          <button
            onClick={() => {
              setSelectedArticle(null);
            }}
            className="hover:text-foreground transition-colors"
          >
            {selectedArticleData.category.title}
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{selectedArticleData.title}</span>
        </div>

        {/* Article Content */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div
                className={`h-12 w-12 rounded-lg ${selectedArticleData.category.bgColor} flex items-center justify-center`}
              >
                <selectedArticleData.category.icon
                  className={`h-6 w-6 ${selectedArticleData.category.color}`}
                />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{selectedArticleData.title}</CardTitle>
                <CardDescription className="text-base mt-1">
                  {selectedArticleData.description}
                </CardDescription>
                <div className="flex gap-2 mt-3">
                  {selectedArticleData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {selectedArticleData.content.split("\n").map((line, i) => {
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={i} className="text-xl font-semibold mt-6 mb-3">
                      {line.replace("## ", "")}
                    </h2>
                  );
                }
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={i} className="text-lg font-medium mt-4 mb-2">
                      {line.replace("### ", "")}
                    </h3>
                  );
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <p key={i} className="font-semibold mt-2">
                      {line.replace(/\*\*/g, "")}
                    </p>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <li key={i} className="ml-4">
                      {line.replace("- ", "")}
                    </li>
                  );
                }
                if (line.startsWith("| ")) {
                  return null;
                }
                if (line.trim() === "") return <br key={i} />;
                return (
                  <p key={i} className="text-muted-foreground">
                    {line}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Related Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Related Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedArticleData.category.articles
                .filter((a) => a.id !== selectedArticle)
                .slice(0, 4)
                .map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article.id)}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{article.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {article.description}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <Button variant="outline" onClick={() => setSelectedArticle(null)}>
          <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
          Back to Help Center
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Search */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Help Center</h1>
        <p className="text-muted-foreground mb-6">
          Find answers, guides, and tutorials to help you get the most out of our AI calling platform
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for help articles, tutorials, or FAQs..."
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
                <Button
                  variant="link"
                  className="h-auto p-0 text-blue-600"
                  onClick={() => setSelectedArticle("first-campaign")}
                >
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
                  <Link href="/dashboard/support">
                    Open Ticket <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
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
                <Button variant="link" className="h-auto p-0 text-purple-600" asChild>
                  <Link href="/dashboard/settings">
                    View Docs <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="articles" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>

        {/* Articles Tab */}
        <TabsContent value="articles" className="mt-6">
          {searchQuery && filteredCategories.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try different keywords or browse categories below
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => (
                <Card
                  key={category.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-lg ${category.bgColor} flex items-center justify-center`}
                      >
                        <category.icon className={`h-5 w-5 ${category.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.title}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {category.articles.slice(0, 4).map((article) => (
                        <li key={article.id}>
                          <button
                            onClick={() => setSelectedArticle(article.id)}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center w-full text-left"
                          >
                            <BookOpen className="h-3 w-3 mr-2 flex-shrink-0" />
                            <span className="line-clamp-1">{article.title}</span>
                          </button>
                        </li>
                      ))}
                      {category.articles.length > 4 && (
                        <li>
                          <Button
                            variant="link"
                            className="h-auto p-0 text-sm"
                          >
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
          )}
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="mt-6">
          <div className="space-y-6">
            {faqs.map((section, sectionIndex) => (
              <Card key={sectionIndex}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    {section.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {section.questions.map((faq, index) => (
                      <AccordionItem key={index} value={`${sectionIndex}-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {videoTutorials.map((video) => (
              <Card
                key={video.id}
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="aspect-video bg-muted flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full bg-primary/90 flex items-center justify-center mb-2">
                      <Play className="h-8 w-8 text-primary-foreground ml-1" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {video.duration}
                    </Badge>
                  </div>
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-1">{video.title}</h3>
                  <p className="text-sm text-muted-foreground">{video.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6 bg-muted/50">
            <CardContent className="py-6 text-center">
              <Video className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">More tutorials coming soon!</h3>
              <p className="text-sm text-muted-foreground">
                We&apos;re constantly adding new video tutorials to help you succeed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tips Section */}
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Pro Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Test Before Launch</p>
                <p className="text-xs text-muted-foreground">
                  Always run test calls before launching a full campaign
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Monitor Early Calls</p>
                <p className="text-xs text-muted-foreground">
                  Check the first 10-20 calls to catch issues early
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Iterate Based on Data</p>
                <p className="text-xs text-muted-foreground">
                  Use analytics to continuously improve your campaigns
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Still Need Help */}
      <Card className="bg-muted/50">
        <CardContent className="py-8 text-center">
          <Headphones className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Can&apos;t find what you&apos;re looking for? Our support team is here to help you succeed.
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

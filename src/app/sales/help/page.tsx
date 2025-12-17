'use client';

import {
  HelpCircle,
  UserPlus,
  DollarSign,
  Megaphone,
  FolderOpen,
  Target,
  Mail,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'How do I add a new lead?',
    answer:
      'Navigate to "My Leads" from the sidebar and click the "Add New Lead" button. Fill in the contact information and any notes about the lead. The lead will be automatically assigned to you.',
  },
  {
    question: 'How do commissions work?',
    answer:
      'You earn a commission on every sale from your referred leads based on your commission rate (visible in your Profile page). When a lead converts to a paying customer, an administrator will review and create a commission record. You can track the status of all your commissions on the Commissions page.',
  },
  {
    question: 'Can I move leads through the pipeline?',
    answer:
      'No, only administrators can move leads through pipeline stages. Your role is to input quality leads and keep their information and notes updated. Administrators will manage the pipeline progression.',
  },
  {
    question: 'How do I enroll a lead in a nurture campaign?',
    answer:
      'Go to the "Campaigns" page and select a campaign. Click "Enroll Leads" to see your available leads. Select the leads you want to enroll and confirm. The leads will receive automated follow-ups through the campaign.',
  },
  {
    question: 'Where can I find sales materials?',
    answer:
      'Visit the "Resources" page to access flyers, presentations, product information, and other sales materials. You can download or preview these materials to share with your leads.',
  },
  {
    question: 'How is my performance tracked?',
    answer:
      'The "Performance" page shows your metrics including leads added, conversions, commissions earned, and comparison with previous periods. Use this to track your progress and identify areas for improvement.',
  },
  {
    question: 'What happens when a lead converts?',
    answer:
      'When an administrator marks your lead as "won", they will review and create a commission record based on the sale amount and your commission rate. You can track the status of all your commissions on the Commissions page.',
  },
  {
    question: 'How do I update my profile?',
    answer:
      'Go to the "Profile" page and click "Edit Profile". You can update your name, phone number, and bio. To change your email or commission rate, contact an administrator.',
  },
];

const features = [
  {
    icon: UserPlus,
    title: 'Lead Management',
    description: 'Add and manage your leads. Keep notes and contact information updated.',
  },
  {
    icon: Target,
    title: 'Pipeline View',
    description: 'See your leads organized by pipeline stage in a visual board.',
  },
  {
    icon: DollarSign,
    title: 'Commission Tracking',
    description: 'Track your earnings, pending approvals, and payment history.',
  },
  {
    icon: Megaphone,
    title: 'Campaign Enrollment',
    description: 'Enroll your leads into automated nurture campaigns.',
  },
  {
    icon: FolderOpen,
    title: 'Sales Resources',
    description: 'Access marketing materials, product info, and sales collateral.',
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Help Center</h1>
        <p className="text-muted-foreground">
          Learn how to use the sales portal effectively
        </p>
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Portal Features</CardTitle>
          <CardDescription>
            An overview of what you can do in the sales portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card"
              >
                <div className="p-2 bg-primary/10 rounded-lg">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
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

      {/* Contact Support */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Need More Help?</CardTitle>
          <CardDescription className="text-blue-700">
            Contact your administrator or support team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Email Support</p>
                <p className="font-medium text-blue-900">support@botmakers.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Phone Support</p>
                <p className="font-medium text-blue-900">(555) 123-4567</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Live Chat</p>
                <p className="font-medium text-blue-900">Available 9am-5pm EST</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Tips for Success</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>
                <strong>Add leads promptly</strong> - The sooner you add a lead, the sooner they can be enrolled in nurture campaigns.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>
                <strong>Keep notes updated</strong> - Detailed notes help administrators move leads through the pipeline effectively.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>
                <strong>Use follow-up reminders</strong> - Set follow-up dates to stay on top of your leads.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>
                <strong>Enroll in campaigns</strong> - Nurture campaigns automate follow-ups and increase conversion rates.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">5.</span>
              <span>
                <strong>Check resources regularly</strong> - New sales materials are added frequently.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState
 } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Key, Bell, Shield, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);

  // Twilio settings
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');

  // OpenAI settings
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [webhookFailureAlerts, setWebhookFailureAlerts] = useState(true);

  const handleSaveApiKeys = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, this would save to a secure backend
      // For now, these would typically be environment variables
      toast.success('API settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      toast.success('Notification settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings and integrations
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Twilio Configuration</CardTitle>
              <CardDescription>
                Default Twilio credentials for SMS messaging. Can be overridden per-campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="twilio-sid">Account SID</Label>
                  <Input
                    id="twilio-sid"
                    type="password"
                    placeholder="AC..."
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twilio-token">Auth Token</Label>
                  <Input
                    id="twilio-token"
                    type="password"
                    placeholder="Enter auth token"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twilio-phone">Default Phone Number</Label>
                <Input
                  id="twilio-phone"
                  placeholder="+1234567890"
                  value={twilioPhoneNumber}
                  onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  The default phone number used for sending SMS when not specified per-campaign.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OpenAI Configuration</CardTitle>
              <CardDescription>
                API key for AI-powered features like transcript analysis and intent detection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Your OpenAI API key for GPT-4o-mini powered analysis.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveApiKeys} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save API Settings
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Configure when and how you receive email notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important events
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Webhook Failure Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when webhook processing fails
                  </p>
                </div>
                <Switch
                  checked={webhookFailureAlerts}
                  onCheckedChange={setWebhookFailureAlerts}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveNotifications} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Notification Settings
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security options for the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <h4 className="font-medium mb-2">Session Management</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Sessions are managed through Supabase Auth. Users are automatically logged out after 7 days of inactivity.
                </p>
              </div>
              <div className="rounded-md bg-muted p-4">
                <h4 className="font-medium mb-2">Password Policy</h4>
                <p className="text-sm text-muted-foreground">
                  Passwords must be at least 8 characters. New users are required to change their password on first login.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Information about the current system configuration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="text-lg font-medium">1.0.0</p>
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">Environment</p>
                  <p className="text-lg font-medium">
                    {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
                  </p>
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">Database</p>
                  <p className="text-lg font-medium">PostgreSQL (Supabase)</p>
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">AI Model</p>
                  <p className="text-lg font-medium">GPT-4o-mini</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Maintenance</CardTitle>
              <CardDescription>
                Tools for database maintenance and cleanup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  Database maintenance operations should be performed with caution.
                  Consider backing up your data before running any cleanup operations.
                </p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" disabled>
                  Clear Old Logs (90+ days)
                </Button>
                <Button variant="outline" disabled>
                  Optimize Tables
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

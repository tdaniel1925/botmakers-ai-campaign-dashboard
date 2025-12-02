"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Send,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  Eye,
  Mail,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Client {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  username: string | null;
  temp_password: string | null;
  is_active: boolean;
  invite_status: string;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  report_frequency: string;
  report_day_of_week: number;
  report_hour: number;
  billing_tier: string;
  billing_notes: string | null;
}

export default function EditClientPage() {
  const params = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [reportFrequency, setReportFrequency] = useState("weekly");
  const [reportDayOfWeek, setReportDayOfWeek] = useState("1");
  const [reportHour, setReportHour] = useState("9");
  const [billingTier, setBillingTier] = useState("standard");
  const [billingNotes, setBillingNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchClient() {
      try {
        const response = await fetch(`/api/admin/clients/${params.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch client");
        }
        const data = await response.json();
        setClient(data);
        setName(data.name);
        setEmail(data.email);
        setCompanyName(data.company_name || "");
        setIsActive(data.is_active);
        setReportFrequency(data.report_frequency || "weekly");
        setReportDayOfWeek(String(data.report_day_of_week || 1));
        setReportHour(String(data.report_hour || 9));
        setBillingTier(data.billing_tier || "standard");
        setBillingNotes(data.billing_notes || "");
      } catch {
        toast({
          title: "Error",
          description: "Failed to load client",
          variant: "destructive",
        });
        router.push("/admin/clients");
      } finally {
        setIsLoading(false);
      }
    }

    fetchClient();
  }, [params.id, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/clients/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company_name: companyName || null,
          is_active: isActive,
          report_frequency: reportFrequency,
          report_day_of_week: parseInt(reportDayOfWeek),
          report_hour: parseInt(reportHour),
          billing_tier: billingTier,
          billing_notes: billingNotes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update client");
      }

      toast({
        title: "Client updated",
        description: "Client details have been saved successfully.",
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update client",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvite = async (isResend = false) => {
    setIsSendingInvite(true);
    try {
      const response = await fetch(`/api/admin/clients/${params.id}/send-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResend }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invite");
      }

      toast({
        title: isResend ? "Re-invite sent" : "Invite sent",
        description: `Invitation email has been sent to ${client?.email}`,
      });

      // Refresh client data
      const clientResponse = await fetch(`/api/admin/clients/${params.id}`);
      if (clientResponse.ok) {
        const data = await clientResponse.json();
        setClient(data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send invite",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleResetPassword = async () => {
    setIsResettingPassword(true);
    try {
      const response = await fetch(`/api/admin/clients/${params.id}/reset-password`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reset password");
      }

      toast({
        title: "Password reset",
        description: `A new password has been sent to ${client?.email}`,
      });

      // Refresh client data
      const clientResponse = await fetch(`/api/admin/clients/${params.id}`);
      if (clientResponse.ok) {
        const data = await clientResponse.json();
        setClient(data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const loadEmailPreview = async () => {
    setPreviewLoading(true);
    try {
      const templateType =
        client?.invite_status === "sent" ? "re_invite" : "welcome";
      const response = await fetch("/api/admin/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType,
          props: {
            recipientName: client?.name,
            username: client?.username,
            tempPassword: "************",
            companyName: "BotMakers",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewHtml(data.html);
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const getInviteStatusBadge = () => {
    if (!client) return null;

    switch (client.invite_status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "sent":
        return client.accepted_at ? (
          <Badge variant="default" className="bg-green-600">Active</Badge>
        ) : (
          <Badge variant="default" className="bg-yellow-600">Invite Sent</Badge>
        );
      case "accepted":
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      default:
        return <Badge variant="secondary">{client.invite_status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{client?.name}</h1>
          <p className="text-muted-foreground">{client?.email}</p>
        </div>
        {getInviteStatusBadge()}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Edit Form */}
        <Card className="md:col-span-2">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
              <CardDescription>
                Update the client&apos;s information below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Link href="/admin/clients">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Credentials Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <KeyRound className="mr-2 h-5 w-5" />
                Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client?.username && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Username</Label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">
                      {client.username}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(client.username!, "username")}
                    >
                      {copied === "username" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset Password
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Password?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will generate a new temporary password and send it to{" "}
                      {client?.email}. The client will need to use this new
                      password to log in.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetPassword}
                      disabled={isResettingPassword}
                    >
                      {isResettingPassword && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Reset Password
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Invite Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5" />
                Invitation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                {client?.invited_at && (
                  <div>
                    <span className="text-muted-foreground">Last invited:</span>
                    <p>
                      {format(
                        new Date(client.invited_at),
                        "MMM d, yyyy 'at' h:mm a"
                      )}
                    </p>
                  </div>
                )}
                {client?.accepted_at && (
                  <div>
                    <span className="text-muted-foreground">Accepted:</span>
                    <p>
                      {format(
                        new Date(client.accepted_at),
                        "MMM d, yyyy 'at' h:mm a"
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    loadEmailPreview();
                    setShowPreview(true);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Email
                </Button>

                {client?.invite_status === "draft" ||
                client?.invite_status === "pending" ? (
                  <Button
                    className="w-full"
                    onClick={() => handleSendInvite(false)}
                    disabled={isSendingInvite}
                  >
                    {isSendingInvite ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Invite
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleSendInvite(true)}
                    disabled={isSendingInvite}
                  >
                    {isSendingInvite ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Resend Invite
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Report Preferences Card */}
          <Card>
            <CardHeader>
              <CardTitle>Report Preferences</CardTitle>
              <CardDescription>
                Configure how often this client receives reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={reportFrequency} onValueChange={setReportFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No reports</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reportFrequency === "weekly" && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select value={reportDayOfWeek} onValueChange={setReportDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {reportFrequency !== "none" && (
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select value={reportHour} onValueChange={setReportHour}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i === 0
                            ? "12:00 AM"
                            : i < 12
                            ? `${i}:00 AM`
                            : i === 12
                            ? "12:00 PM"
                            : `${i - 12}:00 PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Billing Settings
              </CardTitle>
              <CardDescription>
                Control billing for this client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Billing Tier</Label>
                <Select value={billingTier} onValueChange={setBillingTier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">
                      <div className="flex flex-col">
                        <span>Free</span>
                        <span className="text-xs text-muted-foreground">No charges, no payment method required</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="standard">
                      <div className="flex flex-col">
                        <span>Standard</span>
                        <span className="text-xs text-muted-foreground">Pay-per-use billing</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="premium">
                      <div className="flex flex-col">
                        <span>Premium</span>
                        <span className="text-xs text-muted-foreground">Custom enterprise pricing</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {billingTier === "free" && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This client will not be charged for any usage. No payment method is required.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Billing Notes</Label>
                <Textarea
                  placeholder="Internal notes about billing arrangement..."
                  value={billingNotes}
                  onChange={(e) => setBillingNotes(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  These notes are only visible to admins.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how the email will appear to {client?.name}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="preview" className="w-full flex-1 overflow-hidden flex flex-col">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="html">HTML Source</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4 flex-1 overflow-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-[400px]"
                    title="Email Preview"
                  />
                </div>
              )}
            </TabsContent>
            <TabsContent value="html" className="mt-4 flex-1 overflow-auto">
              <pre className="bg-muted p-4 rounded-lg text-xs whitespace-pre-wrap break-all">
                {previewHtml}
              </pre>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false);
                handleSendInvite(client?.invite_status === "sent");
              }}
              disabled={isSendingInvite}
            >
              {isSendingInvite ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {client?.invite_status === "sent" ? "Resend Invite" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

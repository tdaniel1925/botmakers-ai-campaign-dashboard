"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Mail,
  Eye,
  Save,
  Send,
  Copy,
  Check,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [billingTier, setBillingTier] = useState("standard");
  const [billingNotes, setBillingNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Username is the email address
  const previewUsername = email || "john@example.com";
  const previewPassword = "Abc@123#Xyz";

  const loadEmailPreview = async () => {
    if (!name || !email) return;

    setPreviewLoading(true);
    try {
      const response = await fetch("/api/admin/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: "welcome",
          props: {
            recipientName: name,
            username: previewUsername,
            tempPassword: previewPassword,
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

  useEffect(() => {
    if (showPreview && name && email) {
      loadEmailPreview();
    }
  }, [showPreview, name, email]);

  const handleSubmit = async (action: "draft" | "send") => {
    if (!name || !email) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous email error
    setEmailError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company_name: companyName || null,
          billing_tier: billingTier,
          billing_notes: billingNotes || null,
          send_invite: action === "send",
          save_as_draft: action === "draft",
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        // Check if this is an email exists error - show inline
        if (data.code === "email_exists" || response.status === 409) {
          setEmailError(data.error || "A user with this email already exists");
          return;
        }

        throw new Error(data.error || "Failed to create client");
      }

      const data = await response.json();

      if (action === "draft") {
        // Show credentials for draft
        setGeneratedCredentials({
          username: data.username,
          password: data.temp_password,
        });
        toast({
          title: "Client created",
          description: "You can send the invitation later from the client details page.",
        });
      } else {
        toast({
          title: "Client created & invited",
          description: `${name} has been created and an invitation email has been sent.`,
        });
        router.push("/admin/clients");
        router.refresh();
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: "username" | "password") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Client</h1>
          <p className="text-muted-foreground">
            Create a new client account with auto-generated credentials
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
            <CardDescription>
              Enter the client&apos;s information. Credentials will be auto-generated.
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                className={emailError ? "border-destructive" : ""}
                required
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
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

            {/* Credentials Preview */}
            {email && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Generated Credentials Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Username:</span>
                    <code className="bg-background px-2 py-1 rounded">
                      {previewUsername}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Password:</span>
                    <code className="bg-background px-2 py-1 rounded">
                      (auto-generated on save)
                    </code>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  A secure password will be generated when you save the client.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!name || !email}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview Email
            </Button>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => handleSubmit("draft")}
                disabled={isLoading || !name || !email || !!emailError}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Create Client Only
              </Button>
              <Button
                onClick={() => handleSubmit("send")}
                disabled={isLoading || !name || !email || !!emailError}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Create & Send Invite
              </Button>
            </div>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5" />
                Email Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium">What happens when you send?</h4>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>- User account is created</li>
                  <li>- Secure password is generated</li>
                  <li>- Welcome email is sent with credentials</li>
                  <li>- Client can log in immediately</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium">Create Client Only?</h4>
                <p className="mt-1 text-muted-foreground">
                  Creates the client but doesn&apos;t send the email yet. You can send the
                  invite later from the client details page.
                </p>
              </div>
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
                Set billing options for this client
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
                        <span className="text-xs text-muted-foreground">No charges</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="standard">
                      <div className="flex flex-col">
                        <span>Standard</span>
                        <span className="text-xs text-muted-foreground">Pay-per-use</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="premium">
                      <div className="flex flex-col">
                        <span>Premium</span>
                        <span className="text-xs text-muted-foreground">Enterprise</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {billingTier === "free" && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This client won&apos;t be charged for usage.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Billing Notes</Label>
                <Textarea
                  placeholder="Internal notes..."
                  value={billingNotes}
                  onChange={(e) => setBillingNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl w-[90vw] p-0 gap-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how the welcome email will appear to {name || "the client"}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="preview" className="w-full">
            <div className="px-6">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="html">HTML Source</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="preview" className="mt-0 p-6 pt-4">
              {previewLoading ? (
                <div className="flex items-center justify-center h-[500px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white h-[500px]">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full"
                    title="Email Preview"
                    style={{ border: "none", display: "block" }}
                  />
                </div>
              )}
            </TabsContent>
            <TabsContent value="html" className="mt-0 p-6 pt-4">
              <div className="h-[500px] overflow-auto rounded-lg bg-muted">
                <pre className="p-4 text-xs overflow-x-hidden" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "anywhere" }}>
                  {previewHtml}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="p-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false);
                handleSubmit("send");
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Display Dialog */}
      <Dialog
        open={!!generatedCredentials}
        onOpenChange={() => {
          setGeneratedCredentials(null);
          router.push("/admin/clients");
          router.refresh();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Created Successfully</DialogTitle>
            <DialogDescription>
              The client has been saved as a draft. Here are the generated credentials:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-muted p-3 rounded-lg font-mono">
                  {generatedCredentials?.username}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    copyToClipboard(generatedCredentials?.username || "", "username")
                  }
                >
                  {copied === "username" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-muted p-3 rounded-lg font-mono">
                  {generatedCredentials?.password}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    copyToClipboard(generatedCredentials?.password || "", "password")
                  }
                >
                  {copied === "password" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You can send the invitation email later from the client details page.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setGeneratedCredentials(null);
                router.push("/admin/clients");
                router.refresh();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

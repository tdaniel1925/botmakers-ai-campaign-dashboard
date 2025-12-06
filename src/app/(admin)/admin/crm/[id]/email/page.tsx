"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Clock, Eye } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
}

export default function SendEmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    template_id: "",
    subject: "",
    html_body: "",
    text_body: "",
    from_name: "",
    reply_to: "",
    schedule_at: "",
  });

  useEffect(() => {
    fetchContact();
    fetchTemplates();
  }, [id]);

  const fetchContact = async () => {
    try {
      const response = await fetch(`/api/admin/crm/contacts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setContact(data);

        if (!data.email) {
          toast({
            title: "Error",
            description: "This contact has no email address",
            variant: "destructive",
          });
          router.push(`/admin/crm/${id}`);
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contact",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/admin/crm/templates?type=email");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.email_templates || []);
      }
    } catch {
      console.error("Error fetching templates");
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setFormData({ ...formData, template_id: templateId });
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        template_id: templateId,
        subject: template.subject,
        html_body: template.html_body,
        text_body: template.text_body || "",
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const replaceVariables = (text: string) => {
    if (!contact) return text;
    return text
      .replace(/\{\{?first_name\}?\}/gi, contact.first_name || "")
      .replace(/\{\{?last_name\}?\}/gi, contact.last_name || "")
      .replace(
        /\{\{?full_name\}?\}/gi,
        `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
      )
      .replace(/\{\{?email\}?\}/gi, contact.email || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || (!formData.html_body && !formData.text_body)) {
      toast({
        title: "Error",
        description: "Subject and email body are required",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/crm/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: id,
          template_id: formData.template_id || undefined,
          subject: formData.subject,
          html_body: formData.html_body,
          text_body: formData.text_body || undefined,
          from_name: formData.from_name || undefined,
          reply_to: formData.reply_to || undefined,
          schedule_at: formData.schedule_at || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.scheduled) {
          toast({ title: "Email scheduled successfully" });
        } else if (result.sent) {
          toast({ title: "Email sent successfully" });
        } else if (result.queued) {
          toast({
            title: "Email queued",
            description: result.message,
          });
        }
        router.push(`/admin/crm/${id}`);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to send email",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!contact) return null;

  const contactName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Contact";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/crm/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Send Email</h1>
          <p className="text-muted-foreground">
            To: {contactName} ({contact.email})
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Email Composer */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compose Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Use Template</Label>
                    <Select
                      value={formData.template_id}
                      onValueChange={handleTemplateChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Email subject"
                    required
                  />
                </div>

                <Tabs defaultValue="html">
                  <TabsList>
                    <TabsTrigger value="html">HTML Body</TabsTrigger>
                    <TabsTrigger value="text">Plain Text</TabsTrigger>
                  </TabsList>
                  <TabsContent value="html" className="space-y-2">
                    <Textarea
                      id="html_body"
                      name="html_body"
                      value={formData.html_body}
                      onChange={handleChange}
                      placeholder="<p>Hello {{first_name}},</p><p>Your email content here...</p>"
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"}, {"{{email}}"} for dynamic content
                    </p>
                  </TabsContent>
                  <TabsContent value="text" className="space-y-2">
                    <Textarea
                      id="text_body"
                      name="text_body"
                      value={formData.text_body}
                      onChange={handleChange}
                      placeholder="Hello {{first_name}},&#10;&#10;Your email content here..."
                      rows={12}
                    />
                    <p className="text-xs text-muted-foreground">
                      Plain text fallback for email clients that don&apos;t support HTML
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Preview */}
            {showPreview && (
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="text-sm text-muted-foreground mb-2">
                      Subject: {replaceVariables(formData.subject)}
                    </div>
                    {formData.html_body ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: replaceVariables(formData.html_body),
                        }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm">
                        {replaceVariables(formData.text_body)}
                      </pre>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from_name">From Name</Label>
                  <Input
                    id="from_name"
                    name="from_name"
                    value={formData.from_name}
                    onChange={handleChange}
                    placeholder="Your Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reply_to">Reply-To</Label>
                  <Input
                    id="reply_to"
                    name="reply_to"
                    type="email"
                    value={formData.reply_to}
                    onChange={handleChange}
                    placeholder="reply@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule_at">Schedule (Optional)</Label>
                  <Input
                    id="schedule_at"
                    name="schedule_at"
                    type="datetime-local"
                    value={formData.schedule_at}
                    onChange={handleChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to send immediately
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recipient</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-medium">{contactName}</div>
                  <div className="text-sm text-muted-foreground">
                    {contact.email}
                  </div>
                  {contact.company && (
                    <div className="text-sm text-muted-foreground">
                      {contact.company}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <div className="flex gap-4">
            <Link href={`/admin/crm/${id}`}>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={sending}>
              {formData.schedule_at ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  {sending ? "Scheduling..." : "Schedule Email"}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? "Sending..." : "Send Email"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

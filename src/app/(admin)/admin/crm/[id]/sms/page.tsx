"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, Clock } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
}

interface Template {
  id: string;
  name: string;
  message: string;
  character_count: number;
}

export default function SendSmsPage({
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
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    template_id: "",
    message: "",
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

        if (!data.phone) {
          toast({
            title: "Error",
            description: "This contact has no phone number",
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
      const response = await fetch("/api/admin/crm/templates?type=sms");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.sms_templates || []);
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
        message: template.message,
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
      .replace(/\{\{?phone\}?\}/gi, contact.phone || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.message.trim()) {
      toast({
        title: "Error",
        description: "Message is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.message.length > 1600) {
      toast({
        title: "Error",
        description: "Message exceeds maximum length of 1600 characters",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/crm/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: id,
          template_id: formData.template_id || undefined,
          message: formData.message,
          schedule_at: formData.schedule_at || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.scheduled) {
          toast({ title: "SMS scheduled successfully" });
        } else if (result.sent) {
          toast({ title: "SMS sent successfully" });
        } else if (result.queued) {
          toast({
            title: "SMS queued",
            description: result.message,
          });
        }
        router.push(`/admin/crm/${id}`);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to send SMS",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send SMS",
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
  const messageLength = formData.message.length;
  const segments = Math.ceil(messageLength / 160);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/crm/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Send SMS</h1>
          <p className="text-muted-foreground">
            To: {contactName} ({contact.phone})
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* SMS Composer */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Compose SMS</CardTitle>
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
                            {template.name} ({template.character_count} chars)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Hello {{first_name}}, this is a message from..."
                    rows={6}
                    maxLength={1600}
                    required
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Use {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"} for dynamic content
                    </span>
                    <span className={messageLength > 1600 ? "text-red-500" : ""}>
                      {messageLength}/1600 characters ({segments} segment{segments !== 1 ? "s" : ""})
                    </span>
                  </div>
                </div>

                {/* Preview */}
                {formData.message && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="max-w-[300px] ml-auto">
                        <div className="bg-blue-500 text-white rounded-2xl rounded-br-sm p-3 text-sm">
                          {replaceVariables(formData.message)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    {contact.phone}
                  </div>
                  {contact.company && (
                    <div className="text-sm text-muted-foreground">
                      {contact.company}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SMS Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Segment:</strong> Standard SMS messages are 160 characters.
                  Longer messages are split into multiple segments.
                </p>
                <p>
                  <strong>Cost:</strong> Each segment is billed separately by your
                  SMS provider.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link href={`/admin/crm/${id}`}>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={sending || messageLength > 1600}
          >
            {formData.schedule_at ? (
              <>
                <Clock className="mr-2 h-4 w-4" />
                {sending ? "Scheduling..." : "Schedule SMS"}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send SMS"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

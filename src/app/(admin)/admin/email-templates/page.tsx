"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Eye,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Palette,
  FileText,
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  Info,
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  heading: string;
  body_content: string;
  button_text: string | null;
  button_url: string | null;
  footer_text: string | null;
  primary_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const templateVariables: Record<string, string[]> = {
  welcome: ["{{recipientName}}", "{{username}}", "{{tempPassword}}", "{{loginUrl}}", "{{companyName}}"],
  campaign_report: ["{{recipientName}}", "{{reportPeriod}}", "{{totalCalls}}", "{{positiveOutcomes}}", "{{avgDuration}}", "{{dashboardUrl}}", "{{companyName}}", "{{reportFrequency}}"],
  password_reset: ["{{recipientName}}", "{{username}}", "{{tempPassword}}", "{{loginUrl}}", "{{companyName}}"],
  re_invite: ["{{recipientName}}", "{{username}}", "{{tempPassword}}", "{{loginUrl}}", "{{companyName}}"],
};

const sampleData: Record<string, Record<string, unknown>> = {
  welcome: {
    recipientName: "John Smith",
    username: "john.smith",
    tempPassword: "Abc@123#Xyz",
    loginUrl: "https://app.botmakers.io/login",
    companyName: "BotMakers",
  },
  campaign_report: {
    recipientName: "John Smith",
    reportPeriod: "November 2024",
    totalCalls: 156,
    totalCampaigns: 3,
    overallPositiveRate: 72,
    dashboardUrl: "https://app.botmakers.io/dashboard",
    companyName: "BotMakers",
    campaigns: [
      { name: "Sales Outreach", totalCalls: 89, positiveRate: 78, avgDuration: "3:45" },
      { name: "Customer Support", totalCalls: 45, positiveRate: 65, avgDuration: "5:20" },
      { name: "Follow-up Calls", totalCalls: 22, positiveRate: 68, avgDuration: "2:15" },
    ],
  },
  password_reset: {
    recipientName: "John Smith",
    username: "john.smith",
    newTempPassword: "New@456#Pass",
    loginUrl: "https://app.botmakers.io/login",
    companyName: "BotMakers",
  },
  re_invite: {
    recipientName: "John Smith",
    username: "john.smith",
    tempPassword: "Abc@123#Xyz",
    loginUrl: "https://app.botmakers.io/login",
    companyName: "BotMakers",
  },
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<Partial<EmailTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/email-templates");
      const data = await response.json();
      if (data.templates) {
        setTemplates(data.templates);
        if (data.templates.length > 0 && !selectedTemplate) {
          setSelectedTemplate(data.templates[0]);
          setEditedTemplate(data.templates[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      showNotification("error", "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Seed default templates
  const seedTemplates = async () => {
    setSeeding(true);
    try {
      const response = await fetch("/api/admin/email-templates/seed", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        showNotification("success", data.message);
        fetchTemplates();
      } else {
        showNotification("error", data.error || "Failed to seed templates");
      }
    } catch (error) {
      console.error("Error seeding templates:", error);
      showNotification("error", "Failed to seed templates");
    } finally {
      setSeeding(false);
    }
  };

  // Select template
  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditedTemplate({ ...template });
  };

  // Update field
  const handleFieldChange = (field: keyof EmailTemplate, value: string | boolean) => {
    setEditedTemplate((prev) => ({ ...prev, [field]: value }));
  };

  // Save template
  const handleSave = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/email-templates/${selectedTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedTemplate.name,
          subject: editedTemplate.subject,
          heading: editedTemplate.heading,
          bodyContent: editedTemplate.body_content,
          buttonText: editedTemplate.button_text,
          buttonUrl: editedTemplate.button_url,
          footerText: editedTemplate.footer_text,
          primaryColor: editedTemplate.primary_color,
          isActive: editedTemplate.is_active,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("success", "Template saved successfully");
        // Update local state
        setTemplates((prev) =>
          prev.map((t) => (t.id === selectedTemplate.id ? { ...t, ...data.template } : t))
        );
        setSelectedTemplate(data.template);
      } else {
        showNotification("error", data.error || "Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showNotification("error", "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch(`/api/admin/email-templates/${selectedTemplate.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("success", "Template deleted successfully");
        setTemplates((prev) => prev.filter((t) => t.id !== selectedTemplate.id));
        setSelectedTemplate(templates.find((t) => t.id !== selectedTemplate.id) || null);
        setShowDeleteDialog(false);
      } else {
        showNotification("error", data.error || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      showNotification("error", "Failed to delete template");
    }
  };

  // Preview email
  const handlePreview = async () => {
    if (!selectedTemplate) return;

    setPreviewLoading(true);
    try {
      // Include edited template data (like primaryColor) with sample data
      const previewProps = {
        ...(sampleData[selectedTemplate.slug] || sampleData.welcome),
        primaryColor: editedTemplate.primary_color || selectedTemplate.primary_color,
      };

      const response = await fetch("/api/admin/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: selectedTemplate.slug,
          props: previewProps,
        }),
      });

      const data = await response.json();

      if (response.ok && data.html) {
        setPreviewHtml(data.html);
        setShowPreview(true);
      } else {
        showNotification("error", data.error || "Failed to generate preview");
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      showNotification("error", "Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Copy variable to clipboard
  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    showNotification("success", `Copied ${variable} to clipboard`);
  };

  // Check if template has unsaved changes
  const hasChanges = selectedTemplate && JSON.stringify(selectedTemplate) !== JSON.stringify(editedTemplate);

  const isProtectedTemplate = selectedTemplate && ["welcome", "campaign_report", "password_reset", "re_invite"].includes(selectedTemplate.slug);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground">
            Customize email templates sent to your clients
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button onClick={seedTemplates} disabled={seeding}>
              {seeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Initialize Default Templates
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`flex items-center gap-2 rounded-lg p-4 ${
            notification.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {notification.message}
        </div>
      )}

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Email Templates</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Get started by initializing the default email templates. These templates
              are used for welcome emails, campaign reports, password resets, and more.
            </p>
            <Button onClick={seedTemplates} disabled={seeding} size="lg">
              {seeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Templates...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Initialize Default Templates
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Template List */}
          <div className="col-span-12 lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Templates</CardTitle>
                <CardDescription>Select a template to edit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedTemplate?.id === template.id
                        ? "bg-primary/10 border-2 border-primary"
                        : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{template.name}</span>
                      {template.is_active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {template.slug}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Template Editor */}
          <div className="col-span-12 lg:col-span-9">
            {selectedTemplate ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        {selectedTemplate.name}
                        {isProtectedTemplate && (
                          <Badge variant="secondary" className="ml-2">System Template</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Edit the content and styling of this email template
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasChanges && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                          Unsaved Changes
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        onClick={handlePreview}
                        disabled={previewLoading}
                      >
                        {previewLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        Preview
                      </Button>
                      <Button onClick={handleSave} disabled={saving || !hasChanges}>
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="content">
                    <TabsList className="mb-4">
                      <TabsTrigger value="content">
                        <FileText className="mr-2 h-4 w-4" />
                        Content
                      </TabsTrigger>
                      <TabsTrigger value="styling">
                        <Palette className="mr-2 h-4 w-4" />
                        Styling
                      </TabsTrigger>
                      <TabsTrigger value="settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </TabsTrigger>
                    </TabsList>

                    {/* Content Tab */}
                    <TabsContent value="content" className="space-y-6">
                      {/* Available Variables */}
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            Available Variables
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(templateVariables[selectedTemplate.slug] || []).map((variable) => (
                            <button
                              key={variable}
                              onClick={() => copyVariable(variable)}
                              className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs font-mono text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                            >
                              {variable}
                              <Copy className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div>
                          <Label htmlFor="name">Template Name</Label>
                          <Input
                            id="name"
                            value={editedTemplate.name || ""}
                            onChange={(e) => handleFieldChange("name", e.target.value)}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="subject">Email Subject</Label>
                          <Input
                            id="subject"
                            value={editedTemplate.subject || ""}
                            onChange={(e) => handleFieldChange("subject", e.target.value)}
                            className="mt-1.5"
                            placeholder="e.g., Welcome to {{companyName}}"
                          />
                        </div>

                        <div>
                          <Label htmlFor="heading">Email Heading</Label>
                          <Input
                            id="heading"
                            value={editedTemplate.heading || ""}
                            onChange={(e) => handleFieldChange("heading", e.target.value)}
                            className="mt-1.5"
                            placeholder="e.g., Welcome to {{companyName}}!"
                          />
                        </div>

                        <div>
                          <Label htmlFor="body">Email Body Content</Label>
                          <Textarea
                            id="body"
                            value={editedTemplate.body_content || ""}
                            onChange={(e) => handleFieldChange("body_content", e.target.value)}
                            className="mt-1.5 min-h-[200px] font-mono text-sm"
                            placeholder="Use markdown formatting and variables like {{recipientName}}"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Supports basic markdown: **bold**, *italic*, bullet points
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="buttonText">Button Text</Label>
                            <Input
                              id="buttonText"
                              value={editedTemplate.button_text || ""}
                              onChange={(e) => handleFieldChange("button_text", e.target.value)}
                              className="mt-1.5"
                              placeholder="e.g., Sign In Now"
                            />
                          </div>
                          <div>
                            <Label htmlFor="buttonUrl">Button URL</Label>
                            <Input
                              id="buttonUrl"
                              value={editedTemplate.button_url || ""}
                              onChange={(e) => handleFieldChange("button_url", e.target.value)}
                              className="mt-1.5"
                              placeholder="e.g., {{loginUrl}}"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="footer">Footer Text</Label>
                          <Textarea
                            id="footer"
                            value={editedTemplate.footer_text || ""}
                            onChange={(e) => handleFieldChange("footer_text", e.target.value)}
                            className="mt-1.5"
                            rows={2}
                            placeholder="Additional information shown at the bottom"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Styling Tab */}
                    <TabsContent value="styling" className="space-y-6">
                      <div>
                        <Label htmlFor="primaryColor">Primary Color</Label>
                        <div className="flex items-center gap-3 mt-1.5">
                          <input
                            type="color"
                            id="primaryColor"
                            value={editedTemplate.primary_color || "#10B981"}
                            onChange={(e) => handleFieldChange("primary_color", e.target.value)}
                            className="h-10 w-20 cursor-pointer rounded border"
                          />
                          <Input
                            value={editedTemplate.primary_color || "#10B981"}
                            onChange={(e) => handleFieldChange("primary_color", e.target.value)}
                            className="w-32 font-mono"
                            placeholder="#10B981"
                          />
                          <span className="text-sm text-muted-foreground">
                            Used for headings, buttons, and accents
                          </span>
                        </div>
                      </div>

                      {/* Color Presets */}
                      <div>
                        <Label>Color Presets</Label>
                        <div className="flex gap-2 mt-2">
                          {[
                            { color: "#10B981", name: "Emerald" },
                            { color: "#3B82F6", name: "Blue" },
                            { color: "#8B5CF6", name: "Purple" },
                            { color: "#F59E0B", name: "Amber" },
                            { color: "#EF4444", name: "Red" },
                            { color: "#06B6D4", name: "Cyan" },
                          ].map((preset) => (
                            <button
                              key={preset.color}
                              onClick={() => handleFieldChange("primary_color", preset.color)}
                              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                                editedTemplate.primary_color === preset.color
                                  ? "border-foreground scale-110"
                                  : "border-transparent hover:scale-105"
                              }`}
                              style={{ backgroundColor: preset.color }}
                              title={preset.name}
                            />
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    {/* Settings Tab */}
                    <TabsContent value="settings" className="space-y-6">
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <Label htmlFor="isActive" className="text-base">Template Active</Label>
                          <p className="text-sm text-muted-foreground">
                            When disabled, this template won&apos;t be used for sending emails
                          </p>
                        </div>
                        <Switch
                          id="isActive"
                          checked={editedTemplate.is_active ?? true}
                          onCheckedChange={(checked) => handleFieldChange("is_active", checked)}
                        />
                      </div>

                      <div className="rounded-lg border p-4 space-y-2">
                        <Label className="text-base">Template Information</Label>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Slug:</span>
                            <span className="ml-2 font-mono">{selectedTemplate.slug}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-2">
                              {new Date(selectedTemplate.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Last Updated:</span>
                            <span className="ml-2">
                              {new Date(selectedTemplate.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isProtectedTemplate && (
                        <div className="rounded-lg border border-red-200 dark:border-red-800 p-4">
                          <Label className="text-base text-red-600 dark:text-red-400">Danger Zone</Label>
                          <p className="text-sm text-muted-foreground mb-3">
                            Permanently delete this template. This action cannot be undone.
                          </p>
                          <Button
                            variant="destructive"
                            onClick={() => setShowDeleteDialog(true)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Template
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a template to edit</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Email Preview - {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Preview how this email will look to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-gray-100">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[600px] bg-white"
              title="Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedTemplate?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

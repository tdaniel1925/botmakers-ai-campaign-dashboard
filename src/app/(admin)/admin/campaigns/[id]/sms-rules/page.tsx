"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  MessageSquare,
  Zap,
  Edit2,
  Save,
  X,
  Sparkles,
  Brain,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Info,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Supabase returns snake_case column names
interface SmsRuleRow {
  id: string;
  campaign_id: string;
  name: string;
  trigger_condition: string;
  message_template: string;
  is_active: boolean;
  priority: number;
  trigger_count: number | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

// Pre-defined trigger concept templates for common use cases
const TRIGGER_TEMPLATES = [
  {
    category: "Application & Signup",
    icon: "📝",
    templates: [
      {
        name: "Application Request",
        condition: "The caller expresses interest in applying, wants to submit an application, asks how to apply, or says phrases like 'send me an application', 'I want to apply', 'how do I sign up', or 'where can I submit my information'",
        message: "Thanks for your interest! Apply now: [YOUR_LINK]",
      },
      {
        name: "Quote Request",
        condition: "The caller wants a quote, estimate, or pricing information sent to them. They ask for a written quote, want to see numbers, or request pricing details via text",
        message: "Here's the quote you requested: [YOUR_LINK]",
      },
    ],
  },
  {
    category: "Follow-up & Callback",
    icon: "📞",
    templates: [
      {
        name: "Callback Request",
        condition: "The caller explicitly requests a callback, asks to be called back at a specific time, says they're busy now but want to talk later, or needs to schedule a follow-up call",
        message: "We'll call you back as requested. Schedule a specific time here: [YOUR_LINK]",
      },
      {
        name: "Send More Information",
        condition: "The caller wants more details, asks for information to be texted or emailed, wants documentation, or needs to review something before deciding",
        message: "Here's the information you requested: [YOUR_LINK]",
      },
    ],
  },
  {
    category: "Scheduling",
    icon: "📅",
    templates: [
      {
        name: "Appointment Booking",
        condition: "The caller wants to schedule an appointment, book a meeting, set up a consultation, or arrange a time to meet in person or virtually",
        message: "Book your appointment here: [YOUR_LINK]",
      },
      {
        name: "Demo Request",
        condition: "The caller wants to see a demo, requests a product demonstration, wants to try the service, or asks for a walkthrough",
        message: "Schedule your demo: [YOUR_LINK]",
      },
    ],
  },
  {
    category: "Sales & Interest",
    icon: "💰",
    templates: [
      {
        name: "Purchase Interest",
        condition: "The caller expresses strong buying interest, wants to make a purchase, asks how to buy, or indicates they're ready to proceed with a transaction",
        message: "Complete your purchase here: [YOUR_LINK]",
      },
      {
        name: "Special Offer Interest",
        condition: "The caller responds positively to a special offer, promotion, or discount mentioned during the call and wants to take advantage of it",
        message: "Claim your special offer: [YOUR_LINK]",
      },
    ],
  },
  {
    category: "Support & Issues",
    icon: "🔧",
    templates: [
      {
        name: "Support Ticket",
        condition: "The caller has an unresolved issue, needs technical support that couldn't be handled on the call, or requires escalation to a support team",
        message: "Track your support request: [YOUR_LINK]",
      },
      {
        name: "Complaint Resolution",
        condition: "The caller expressed dissatisfaction, made a complaint, or had a negative experience that needs follow-up resolution",
        message: "We take your feedback seriously. Share more details: [YOUR_LINK]",
      },
    ],
  },
];

export default function SmsRulesPage() {
  const params = useParams();
  const [rules, setRules] = useState<SmsRuleRow[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newTriggerCondition, setNewTriggerCondition] = useState("");
  const [newMessageTemplate, setNewMessageTemplate] = useState("");
  const [templateCategoryOpen, setTemplateCategoryOpen] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      // Fetch campaign name - check both tables
      const { data: outboundCampaign } = await supabase
        .from("outbound_campaigns")
        .select("name")
        .eq("id", params.id)
        .single();

      if (outboundCampaign) {
        setCampaignName(outboundCampaign.name);
      } else {
        const { data: inboundCampaign } = await supabase
          .from("inbound_campaigns")
          .select("name")
          .eq("id", params.id)
          .single();

        if (inboundCampaign) {
          setCampaignName(inboundCampaign.name);
        }
      }

      // Fetch SMS rules
      const { data, error } = await supabase
        .from("sms_rules")
        .select("*")
        .eq("campaign_id", params.id)
        .order("priority", { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load SMS rules",
          variant: "destructive",
        });
      } else {
        setRules(data || []);
      }
      setIsLoading(false);
    }

    fetchData();
  }, [params.id, supabase, toast]);

  const handleAddRule = async () => {
    if (!newRuleName.trim() || !newTriggerCondition.trim() || !newMessageTemplate.trim()) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    if (newMessageTemplate.length > 1600) {
      toast({
        title: "Error",
        description: "SMS message must be under 1600 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from("sms_rules")
        .insert({
          campaign_id: params.id,
          name: newRuleName,
          trigger_condition: newTriggerCondition,
          message_template: newMessageTemplate,
          priority: rules.length,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setRules([data, ...rules]);
      setNewRuleName("");
      setNewTriggerCondition("");
      setNewMessageTemplate("");
      setShowAddForm(false);

      toast({
        title: "SMS Rule Created",
        description: `AI will now analyze calls for "${newRuleName}" triggers`,
      });
    } catch (error) {
      console.error("Error adding rule:", error);
      toast({
        title: "Error",
        description: "Failed to add SMS rule",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const applyTemplate = (condition: string, message: string, name: string) => {
    setNewRuleName(name);
    setNewTriggerCondition(condition);
    setNewMessageTemplate(message);
    setShowAddForm(true);
    toast({
      title: "Template Applied",
      description: "Customize the trigger condition and message for your needs",
    });
  };

  const confirmDeleteRule = async () => {
    if (!deleteRuleId) return;

    try {
      const { error } = await supabase
        .from("sms_rules")
        .delete()
        .eq("id", deleteRuleId);

      if (error) throw error;

      setRules(rules.filter((r) => r.id !== deleteRuleId));

      toast({
        title: "Rule Deleted",
        description: "The SMS rule has been removed",
      });
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    } finally {
      setDeleteRuleId(null);
    }
  };

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("sms_rules")
        .update({ is_active: isActive })
        .eq("id", ruleId);

      if (error) throw error;

      setRules(rules.map((r) => (r.id === ruleId ? { ...r, is_active: isActive } : r)));
    } catch (error) {
      console.error("Error updating rule:", error);
      toast({
        title: "Error",
        description: "Failed to update rule",
        variant: "destructive",
      });
    }
  };

  const startEditing = (rule: SmsRuleRow) => {
    setEditingId(rule.id);
    setEditName(rule.name);
    setEditCondition(rule.trigger_condition);
    setEditMessage(rule.message_template);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditCondition("");
    setEditMessage("");
  };

  const saveEditing = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from("sms_rules")
        .update({
          name: editName,
          trigger_condition: editCondition,
          message_template: editMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) throw error;

      setRules(
        rules.map((r) =>
          r.id === editingId
            ? {
                ...r,
                name: editName,
                trigger_condition: editCondition,
                message_template: editMessage,
              }
            : r
        )
      );

      toast({
        title: "Rule Updated",
        description: "SMS rule has been saved",
      });

      cancelEditing();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast({
        title: "Error",
        description: "Failed to save rule",
        variant: "destructive",
      });
    }
  };

  const getSegmentCount = (text: string) => {
    const isUnicode = /[^\x00-\x7F]/.test(text);
    const charsPerSegment = isUnicode ? 70 : 160;
    return Math.ceil(text.length / charsPerSegment) || 1;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href={`/admin/campaigns/${params.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-purple-500" />
              AI-Powered SMS Triggers
            </h1>
            <p className="text-muted-foreground">
              Automatically send SMS when AI detects specific intents in call conversations
              {campaignName && ` • ${campaignName}`}
            </p>
          </div>
        </div>

        {/* How It Works Section */}
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-purple-600" />
              How AI SMS Triggers Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-2 text-purple-600 dark:text-purple-400 font-bold text-sm">1</div>
                <div>
                  <p className="font-medium text-sm">Call Ends</p>
                  <p className="text-xs text-muted-foreground">Webhook delivers call transcript</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-2 text-purple-600 dark:text-purple-400 font-bold text-sm">2</div>
                <div>
                  <p className="font-medium text-sm">AI Analysis</p>
                  <p className="text-xs text-muted-foreground">GPT analyzes conversation intent</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-2 text-purple-600 dark:text-purple-400 font-bold text-sm">3</div>
                <div>
                  <p className="font-medium text-sm">Rule Matching</p>
                  <p className="text-xs text-muted-foreground">AI checks if triggers apply</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-2 text-purple-600 dark:text-purple-400 font-bold text-sm">4</div>
                <div>
                  <p className="font-medium text-sm">SMS Sent</p>
                  <p className="text-xs text-muted-foreground">Message delivered to caller</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Start Templates
            </CardTitle>
            <CardDescription>
              Pre-built AI trigger conditions for common scenarios. Click to customize and add.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {TRIGGER_TEMPLATES.map((category) => (
              <Collapsible
                key={category.category}
                open={templateCategoryOpen === category.category}
                onOpenChange={(open) => setTemplateCategoryOpen(open ? category.category : null)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between py-3 h-auto">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium">{category.category}</span>
                      <Badge variant="secondary" className="ml-2">{category.templates.length}</Badge>
                    </span>
                    {templateCategoryOpen === category.category ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-2 pt-2 pl-8">
                    {category.templates.map((template) => (
                      <div
                        key={template.name}
                        className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => applyTemplate(template.condition, template.message, template.name)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7">
                            <Plus className="h-3 w-3 mr-1" />
                            Use
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {template.condition}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        {/* Add New Rule Form */}
        <Collapsible open={showAddForm} onOpenChange={setShowAddForm}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create Custom SMS Trigger
                  </CardTitle>
                  <CardDescription>
                    Define a natural language condition for AI to detect in call conversations
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant={showAddForm ? "secondary" : "default"}>
                    {showAddForm ? "Cancel" : "Add New Rule"}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="ruleName">Rule Name</Label>
                  <Input
                    id="ruleName"
                    placeholder="e.g., Application Link Request"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="triggerCondition">AI Trigger Condition</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>Describe the caller intent or phrases that should trigger this SMS. AI will understand variations and context.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    id="triggerCondition"
                    placeholder="e.g., The caller expresses interest in applying, wants to submit an application, asks how to apply, or says phrases like 'send me an application', 'I want to apply', 'how do I sign up'"
                    value={newTriggerCondition}
                    onChange={(e) => setNewTriggerCondition(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Tips for better AI detection:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          <li>Include specific phrases callers might say in quotes</li>
                          <li>Describe the underlying intent (not just keywords)</li>
                          <li>Include variations of how someone might express this</li>
                          <li>Be specific but not overly restrictive</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="messageTemplate">SMS Message</Label>
                    <Badge variant="outline" className="text-xs">
                      {newMessageTemplate.length}/160 • {getSegmentCount(newMessageTemplate)} segment{getSegmentCount(newMessageTemplate) > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <Textarea
                    id="messageTemplate"
                    placeholder="Thanks for your interest! Apply here: https://example.com/apply"
                    value={newMessageTemplate}
                    onChange={(e) => setNewMessageTemplate(e.target.value)}
                    rows={3}
                    maxLength={1600}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LinkIcon className="h-3 w-3" />
                    Include a link for callers to take action
                  </div>
                </div>

                <Button
                  onClick={handleAddRule}
                  disabled={isSaving || !newRuleName.trim() || !newTriggerCondition.trim() || !newMessageTemplate.trim()}
                  className="w-full"
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create AI Trigger Rule
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Active Rules List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Active Trigger Rules ({rules.filter(r => r.is_active).length}/{rules.length})
              </span>
            </CardTitle>
            <CardDescription>
              AI evaluates each call against these conditions. Only the highest-priority matching rule triggers SMS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length > 0 ? (
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className={`border rounded-lg p-4 space-y-3 transition-colors ${
                      rule.is_active
                        ? "bg-background"
                        : "bg-muted/30 opacity-60"
                    }`}
                  >
                    {editingId === rule.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Rule name"
                        />
                        <Textarea
                          value={editCondition}
                          onChange={(e) => setEditCondition(e.target.value)}
                          placeholder="AI trigger condition"
                          rows={3}
                          className="font-mono text-sm"
                        />
                        <Textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          placeholder="SMS message"
                          rows={2}
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={saveEditing}>
                            <Save className="mr-1 h-3 w-3" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing}>
                            <X className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                              <h4 className="font-medium">{rule.name}</h4>
                              {rule.is_active ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Paused</Badge>
                              )}
                            </div>
                            {(rule.trigger_count ?? 0) > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Triggered {rule.trigger_count} time{rule.trigger_count !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={rule.is_active || false}
                              onCheckedChange={(checked) =>
                                handleToggleActive(rule.id, checked)
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Brain className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm">
                                <span className="font-medium text-purple-700 dark:text-purple-300">AI detects: </span>
                                <span className="text-purple-900 dark:text-purple-100">{rule.trigger_condition}</span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm">
                                <span className="font-medium text-green-700 dark:text-green-300">Sends SMS: </span>
                                <span className="text-green-900 dark:text-green-100 font-mono text-xs">
                                  {rule.message_template}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(rule)}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteRuleId(rule.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No SMS trigger rules configured</p>
                <p className="text-sm mt-1">Use a template above or create a custom rule to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteRuleId} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete SMS Trigger Rule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this trigger rule? AI will no longer analyze calls
                for this condition and no SMS will be sent for matching conversations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteRule}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete Rule
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

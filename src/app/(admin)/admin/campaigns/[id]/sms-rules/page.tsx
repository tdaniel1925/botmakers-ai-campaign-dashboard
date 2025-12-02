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
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SmsRule } from "@/lib/db/schema";

export default function SmsRulesPage() {
  const params = useParams();
  const [rules, setRules] = useState<SmsRule[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newTriggerCondition, setNewTriggerCondition] = useState("");
  const [newMessageTemplate, setNewMessageTemplate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      // Fetch campaign name
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("name")
        .eq("id", params.id)
        .single();

      if (campaign) {
        setCampaignName(campaign.name);
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

      toast({
        title: "SMS Rule Added",
        description: `"${newRuleName}" will now trigger SMS messages`,
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

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("sms_rules")
        .delete()
        .eq("id", ruleId);

      if (error) throw error;

      setRules(rules.filter((r) => r.id !== ruleId));

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
    }
  };

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("sms_rules")
        .update({ is_active: isActive })
        .eq("id", ruleId);

      if (error) throw error;

      setRules(rules.map((r) => (r.id === ruleId ? { ...r, isActive } : r)));
    } catch (error) {
      console.error("Error updating rule:", error);
      toast({
        title: "Error",
        description: "Failed to update rule",
        variant: "destructive",
      });
    }
  };

  const startEditing = (rule: SmsRule) => {
    setEditingId(rule.id);
    setEditName(rule.name);
    setEditCondition(rule.triggerCondition);
    setEditMessage(rule.messageTemplate);
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
                triggerCondition: editCondition,
                messageTemplate: editMessage,
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
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/admin/campaigns/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Rules</h1>
          <p className="text-muted-foreground">
            Configure automated SMS messages for {campaignName || "this campaign"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add New Rule Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Add New SMS Rule
            </CardTitle>
            <CardDescription>
              Define when to send SMS based on call conversation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name</Label>
              <Input
                id="ruleName"
                placeholder="e.g., Send application link"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="triggerCondition">
                Trigger Condition
                <span className="text-xs text-muted-foreground ml-2">
                  (Natural language)
                </span>
              </Label>
              <Textarea
                id="triggerCondition"
                placeholder="e.g., If the caller wants to apply for a loan or requests an application"
                value={newTriggerCondition}
                onChange={(e) => setNewTriggerCondition(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Describe when this SMS should be sent. AI will analyze each call and
                determine if it matches this condition.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="messageTemplate">
                SMS Message
                <span className="text-xs text-muted-foreground ml-2">
                  ({newMessageTemplate.length}/160 chars, {getSegmentCount(newMessageTemplate)} segment{getSegmentCount(newMessageTemplate) > 1 ? "s" : ""})
                </span>
              </Label>
              <Textarea
                id="messageTemplate"
                placeholder="Thank you for your interest! Apply here: https://example.com/apply"
                value={newMessageTemplate}
                onChange={(e) => setNewMessageTemplate(e.target.value)}
                rows={4}
                maxLength={1600}
              />
              <p className="text-xs text-muted-foreground">
                Keep messages concise. Each 160-character segment costs separately.
              </p>
            </div>

            <Button
              onClick={handleAddRule}
              disabled={isSaving || !newRuleName.trim() || !newTriggerCondition.trim() || !newMessageTemplate.trim()}
              className="w-full"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <MessageSquare className="mr-2 h-4 w-4" />
              Add SMS Rule
            </Button>
          </CardContent>
        </Card>

        {/* Existing Rules Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              Active Rules ({rules.length})
            </CardTitle>
            <CardDescription>
              SMS will be sent when call analysis matches these conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length > 0 ? (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="border rounded-lg p-4 space-y-3"
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
                          placeholder="Trigger condition"
                          rows={2}
                        />
                        <Textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          placeholder="SMS message"
                          rows={3}
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
                              <h4 className="font-medium">{rule.name}</h4>
                              {rule.isActive ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            {rule.triggerCount && rule.triggerCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Triggered {rule.triggerCount} times
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={rule.isActive || false}
                              onCheckedChange={(checked) =>
                                handleToggleActive(rule.id, checked)
                              }
                            />
                          </div>
                        </div>

                        <div className="text-sm space-y-2">
                          <div>
                            <span className="text-muted-foreground">When: </span>
                            <span className="text-foreground">{rule.triggerCondition}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Send: </span>
                            <span className="text-foreground bg-muted px-2 py-1 rounded text-xs font-mono">
                              {rule.messageTemplate.length > 100
                                ? rule.messageTemplate.substring(0, 100) + "..."
                                : rule.messageTemplate}
                            </span>
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
                            onClick={() => handleDeleteRule(rule.id)}
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
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No SMS rules configured yet.</p>
                <p className="text-sm">Add your first rule to enable automated SMS.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>How SMS Rules Work</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>When a call ends, the AI analyzes the transcript</li>
            <li>The AI evaluates each active SMS rule against the call content</li>
            <li>If a rule&apos;s trigger condition matches, the SMS is sent to the caller</li>
            <li>Only ONE SMS is sent per call (highest priority matching rule)</li>
            <li>SMS costs are tracked and billed to the client</li>
          </ol>
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Tip:</strong> Write clear, specific trigger conditions for best results.
              Example: &quot;If the caller explicitly requests a callback or asks to be contacted later&quot;
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

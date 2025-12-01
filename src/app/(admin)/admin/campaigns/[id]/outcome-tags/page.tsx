"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CampaignOutcomeTag } from "@/lib/db/schema";

const DEFAULT_COLORS = [
  "#22c55e", // green
  "#ef4444", // red
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
  "#14b8a6", // teal
];

export default function OutcomeTagsPage() {
  const params = useParams();
  const [tags, setTags] = useState<CampaignOutcomeTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);
  const [newTagPositive, setNewTagPositive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    async function fetchTags() {
      const { data, error } = await supabase
        .from("campaign_outcome_tags")
        .select("*")
        .eq("campaign_id", params.id)
        .order("sort_order");

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load tags",
          variant: "destructive",
        });
      } else {
        setTags(data || []);
      }
      setIsLoading(false);
    }

    fetchTags();
  }, [params.id, supabase, toast]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      toast({
        title: "Error",
        description: "Tag name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from("campaign_outcome_tags")
        .insert({
          campaign_id: params.id,
          tag_name: newTagName,
          tag_color: newTagColor,
          is_positive: newTagPositive,
          sort_order: tags.length,
        })
        .select()
        .single();

      if (error) throw error;

      setTags([...tags, data]);
      setNewTagName("");
      setNewTagColor(DEFAULT_COLORS[(tags.length + 1) % DEFAULT_COLORS.length]);
      setNewTagPositive(false);

      toast({
        title: "Tag added",
        description: `"${newTagName}" has been added`,
      });
    } catch (error) {
      console.error("Error adding tag:", error);
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from("campaign_outcome_tags")
        .delete()
        .eq("id", tagId);

      if (error) throw error;

      setTags(tags.filter((t) => t.id !== tagId));

      toast({
        title: "Tag deleted",
        description: "The tag has been removed",
      });
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast({
        title: "Error",
        description: "Failed to delete tag",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTag = async (
    tagId: string,
    updates: Partial<CampaignOutcomeTag>
  ) => {
    try {
      const { error } = await supabase
        .from("campaign_outcome_tags")
        .update(updates)
        .eq("id", tagId);

      if (error) throw error;

      setTags(tags.map((t) => (t.id === tagId ? { ...t, ...updates } : t)));
    } catch (error) {
      console.error("Error updating tag:", error);
      toast({
        title: "Error",
        description: "Failed to update tag",
        variant: "destructive",
      });
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
        <Link href={`/admin/campaigns/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outcome Tags</h1>
          <p className="text-muted-foreground">
            Define the possible outcomes for calls in this campaign
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Tags</CardTitle>
            <CardDescription>
              These tags will be used by AI to categorize calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tags.length > 0 ? (
              <div className="space-y-3">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <Badge
                        style={{
                          backgroundColor: tag.tagColor || "#6b7280",
                          color: "#fff",
                        }}
                      >
                        {tag.tagName}
                      </Badge>
                      {tag.isPositive && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          Positive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={tag.isPositive || false}
                        onCheckedChange={(checked) =>
                          handleUpdateTag(tag.id, { isPositive: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No tags defined yet. Add your first outcome tag.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add New Tag</CardTitle>
            <CardDescription>
              Create a new outcome category for this campaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Tag Name</Label>
              <Input
                id="tagName"
                placeholder="e.g., Interested, Not Available"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tag Color</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      newTagColor === color
                        ? "border-gray-900 scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isPositive"
                checked={newTagPositive}
                onCheckedChange={setNewTagPositive}
              />
              <Label htmlFor="isPositive">
                Mark as positive outcome (for analytics)
              </Label>
            </div>

            <div className="pt-2">
              <Label>Preview</Label>
              <div className="mt-2">
                <Badge
                  style={{
                    backgroundColor: newTagColor,
                    color: "#fff",
                  }}
                >
                  {newTagName || "Tag Name"}
                </Badge>
              </div>
            </div>

            <Button
              onClick={handleAddTag}
              disabled={isSaving || !newTagName.trim()}
              className="w-full"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              Add Tag
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

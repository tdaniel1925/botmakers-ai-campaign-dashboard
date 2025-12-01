"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AudioPlayer } from "./audio-player";
import {
  Phone,
  Clock,
  Calendar,
  Smile,
  Frown,
  Meh,
  Copy,
  ChevronDown,
  ChevronUp,
  Volume2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { formatDuration, maskPhoneNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Support both camelCase (Drizzle) and snake_case (Supabase direct) field names
interface CallData {
  id: string;
  transcript: string;
  // Timestamps - support both cases
  callTimestamp?: Date | string | null;
  call_timestamp?: Date | string | null;
  createdAt?: Date | string | null;
  created_at?: Date | string | null;
  // Duration - support both cases
  callDuration?: number | null;
  call_duration?: number | null;
  // Phone - support both cases
  callerPhone?: string | null;
  caller_phone?: string | null;
  // Audio - support both cases
  audioUrl?: string | null;
  audio_url?: string | null;
  // AI fields - support both cases
  aiSentiment?: string | null;
  ai_sentiment?: string | null;
  aiSummary?: string | null;
  ai_summary?: string | null;
  aiKeyPoints?: unknown;
  ai_key_points?: unknown;
  aiCallerIntent?: string | null;
  ai_caller_intent?: string | null;
  aiResolution?: string | null;
  ai_resolution?: string | null;
  // Outcome tags
  campaign_outcome_tags?: {
    tag_name: string;
    tag_color: string;
  } | null;
}

interface CallDetailProps {
  call: CallData & Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetail({ call, open, onOpenChange }: CallDetailProps) {
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const { toast } = useToast();

  // Helper to get value from either camelCase or snake_case
  const timestamp = call.callTimestamp || call.call_timestamp;
  const createdAt = call.createdAt || call.created_at;
  const duration = call.callDuration ?? call.call_duration;
  const phone = call.callerPhone || call.caller_phone;
  const audioUrl = call.audioUrl || call.audio_url;
  const sentiment = call.aiSentiment || call.ai_sentiment;
  const summary = call.aiSummary || call.ai_summary;
  const keyPoints = (call.aiKeyPoints || call.ai_key_points) as string[] | null;
  const callerIntent = call.aiCallerIntent || call.ai_caller_intent;
  const resolution = call.aiResolution || call.ai_resolution;

  const getSentimentIcon = () => {
    switch (sentiment) {
      case "positive":
        return <Smile className="h-5 w-5 text-green-500" />;
      case "negative":
        return <Frown className="h-5 w-5 text-red-500" />;
      default:
        return <Meh className="h-5 w-5 text-gray-500" />;
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(call.transcript);
    toast({
      title: "Copied",
      description: "Transcript copied to clipboard",
    });
  };

  const getDisplayDate = () => {
    const dateValue = timestamp || createdAt;
    if (!dateValue) return "Unknown date";
    try {
      return format(new Date(dateValue), "PPP 'at' p");
    } catch {
      return "Invalid date";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Call Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{getDisplayDate()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{duration ? formatDuration(duration) : "N/A"}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{phone ? maskPhoneNumber(phone) : "Unknown"}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center space-x-3">
              {call.campaign_outcome_tags && (
                <Badge
                  className="text-sm px-3 py-1"
                  style={{
                    backgroundColor: call.campaign_outcome_tags.tag_color,
                    color: "#fff",
                  }}
                >
                  {call.campaign_outcome_tags.tag_name}
                </Badge>
              )}
              <div className="flex items-center space-x-1">
                {getSentimentIcon()}
                <span className="capitalize">{sentiment || "Pending"}</span>
              </div>
            </div>

            <Separator />

            {/* AI Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>AI Summary</span>
              </h3>
              {summary ? (
                <p className="text-muted-foreground">{summary}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  Summary pending AI processing...
                </p>
              )}
            </div>

            {/* Key Points */}
            {keyPoints && keyPoints.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Key Points</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Caller Intent & Resolution */}
            <div className="grid grid-cols-2 gap-4">
              {callerIntent && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Caller Intent
                  </h4>
                  <p>{callerIntent}</p>
                </div>
              )}
              {resolution && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Resolution
                  </h4>
                  <p className="capitalize">{resolution}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Audio Player */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center space-x-2">
                <Volume2 className="h-4 w-4" />
                <span>Recording</span>
              </h3>
              {audioUrl ? (
                <AudioPlayer src={audioUrl} />
              ) : (
                <p className="text-muted-foreground italic">
                  Audio recording not available
                </p>
              )}
            </div>

            <Separator />

            {/* Transcript */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Transcript</h3>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={copyTranscript}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                  >
                    {isTranscriptExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Collapse
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Expand
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div
                className={`bg-muted rounded-lg p-4 ${
                  isTranscriptExpanded ? "" : "max-h-48 overflow-hidden"
                }`}
              >
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {call.transcript}
                </pre>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

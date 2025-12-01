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
import type { Call } from "@/lib/db/schema";

interface CallDetailProps {
  call: Call & {
    campaign_outcome_tags?: {
      tag_name: string;
      tag_color: string;
    } | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetail({ call, open, onOpenChange }: CallDetailProps) {
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const { toast } = useToast();

  const getSentimentIcon = () => {
    switch (call.aiSentiment) {
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

  const keyPoints = call.aiKeyPoints as string[] | null;

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
                <span>
                  {call.callTimestamp
                    ? format(new Date(call.callTimestamp), "PPP 'at' p")
                    : format(new Date(call.createdAt!), "PPP 'at' p")}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {call.callDuration ? formatDuration(call.callDuration) : "N/A"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>
                  {call.callerPhone ? maskPhoneNumber(call.callerPhone) : "Unknown"}
                </span>
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
                <span className="capitalize">{call.aiSentiment || "Pending"}</span>
              </div>
            </div>

            <Separator />

            {/* AI Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>AI Summary</span>
              </h3>
              {call.aiSummary ? (
                <p className="text-muted-foreground">{call.aiSummary}</p>
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
              {call.aiCallerIntent && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Caller Intent
                  </h4>
                  <p>{call.aiCallerIntent}</p>
                </div>
              )}
              {call.aiResolution && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Resolution
                  </h4>
                  <p className="capitalize">{call.aiResolution}</p>
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
              {call.audioUrl ? (
                <AudioPlayer src={call.audioUrl} />
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

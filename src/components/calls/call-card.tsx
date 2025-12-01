import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, Smile, Frown, Meh } from "lucide-react";
import { format } from "date-fns";
import { formatDuration, maskPhoneNumber } from "@/lib/utils";

// Support both camelCase (Drizzle) and snake_case (Supabase direct) field names
interface CallData {
  id: string;
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
  // AI fields - support both cases
  aiSentiment?: string | null;
  ai_sentiment?: string | null;
  aiSummary?: string | null;
  ai_summary?: string | null;
  // Outcome tags
  campaign_outcome_tags?: {
    tag_name: string;
    tag_color: string;
  } | null;
}

interface CallCardProps {
  call: CallData;
  onClick?: () => void;
}

export function CallCard({ call, onClick }: CallCardProps) {
  // Helper to get value from either camelCase or snake_case
  const timestamp = call.callTimestamp || call.call_timestamp;
  const createdAt = call.createdAt || call.created_at;
  const duration = call.callDuration ?? call.call_duration;
  const phone = call.callerPhone || call.caller_phone;
  const sentiment = call.aiSentiment || call.ai_sentiment;
  const summary = call.aiSummary || call.ai_summary;

  const getSentimentIcon = () => {
    switch (sentiment) {
      case "positive":
        return <Smile className="h-4 w-4 text-green-500" />;
      case "negative":
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-500" />;
    }
  };

  const getDisplayDate = () => {
    const dateValue = timestamp || createdAt;
    if (!dateValue) return "Unknown date";
    try {
      return format(new Date(dateValue), "MMM d, yyyy h:mm a");
    } catch {
      return "Invalid date";
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {getDisplayDate()}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {duration ? formatDuration(duration) : "N/A"}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <span className="font-medium">
            {phone ? maskPhoneNumber(phone) : "Unknown"}
          </span>
        </div>

        <div className="mt-3 flex items-center space-x-2">
          {call.campaign_outcome_tags && (
            <Badge
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
            <span className="text-xs capitalize text-muted-foreground">
              {sentiment || "Pending"}
            </span>
          </div>
        </div>

        {summary && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

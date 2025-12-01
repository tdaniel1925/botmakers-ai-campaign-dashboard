import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, Smile, Frown, Meh } from "lucide-react";
import { format } from "date-fns";
import { formatDuration, maskPhoneNumber } from "@/lib/utils";
import type { Call } from "@/lib/db/schema";

interface CallCardProps {
  call: Call & {
    campaign_outcome_tags?: {
      tag_name: string;
      tag_color: string;
    } | null;
  };
  onClick?: () => void;
}

export function CallCard({ call, onClick }: CallCardProps) {
  const getSentimentIcon = () => {
    switch (call.aiSentiment) {
      case "positive":
        return <Smile className="h-4 w-4 text-green-500" />;
      case "negative":
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-500" />;
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
              {call.callTimestamp
                ? format(new Date(call.callTimestamp), "MMM d, yyyy h:mm a")
                : format(new Date(call.createdAt!), "MMM d, yyyy h:mm a")}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {call.callDuration ? formatDuration(call.callDuration) : "N/A"}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <span className="font-medium">
            {call.callerPhone ? maskPhoneNumber(call.callerPhone) : "Unknown"}
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
              {call.aiSentiment || "Pending"}
            </span>
          </div>
        </div>

        {call.aiSummary && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {call.aiSummary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

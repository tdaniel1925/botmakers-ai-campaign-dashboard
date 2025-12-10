"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  Loader2,
  RefreshCw,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
  Play,
  FileText,
  User,
  Calendar,
  ExternalLink,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Call {
  id: string;
  campaign_id: string;
  contact_id: string;
  phone_number: string;
  status: "initiated" | "ringing" | "answered" | "completed" | "failed" | "no_answer" | "busy";
  outcome: "positive" | "negative" | "neutral" | null;
  duration_seconds: number | null;
  cost: string | null;
  recording_url: string | null;
  transcript: string | null;
  structured_data: Record<string, unknown> | null;
  created_at: string;
  ended_at: string | null;
  contact?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

interface SmsLog {
  id: string;
  status: string;
  twilioStatus: string | null;
  messageBody: string;
  phoneNumber: string;
  recipientName: string | null;
  ruleName: string | null;
  segmentCount: number | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export default function ClientCallLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });

  const { toast } = useToast();

  // Fetch SMS logs when a call is selected
  const fetchSmsLogs = async (callId: string) => {
    setSmsLoading(true);
    try {
      const response = await fetch(`/api/client/outbound-campaigns/${id}/calls/${callId}/sms`);
      if (!response.ok) throw new Error("Failed to fetch SMS logs");
      const data = await response.json();
      setSmsLogs(data.smsLogs || []);
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
      setSmsLogs([]);
    } finally {
      setSmsLoading(false);
    }
  };

  // Handle call selection and fetch SMS logs
  const handleSelectCall = (call: Call) => {
    setSelectedCall(call);
    setSmsLogs([]);
    fetchSmsLogs(call.id);
  };

  const getSmsStatusBadge = (status: string, twilioStatus: string | null) => {
    const displayStatus = twilioStatus || status;
    switch (displayStatus) {
      case "delivered":
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Delivered</Badge>;
      case "sent":
        return <Badge variant="secondary" className="gap-1"><Send className="h-3 w-3" />Sent</Badge>;
      case "queued":
      case "sending":
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Sending</Badge>;
      case "undelivered":
        return <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" />Undelivered</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return <Badge>{displayStatus}</Badge>;
    }
  };

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/client/outbound-campaigns/${id}/calls?${params}`);
      if (!response.ok) throw new Error("Failed to fetch calls");
      const data = await response.json();
      setCalls(data.calls || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching calls:", error);
      toast({
        title: "Error",
        description: "Failed to load call logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [id, pagination.page, statusFilter, outcomeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCalls();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "answered":
        return <Badge variant="success">Answered</Badge>;
      case "no_answer":
        return <Badge variant="secondary">No Answer</Badge>;
      case "busy":
        return <Badge variant="warning">Busy</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "ringing":
        return <Badge variant="warning">Ringing</Badge>;
      case "initiated":
        return <Badge variant="secondary">Initiated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return null;
    switch (outcome) {
      case "positive":
        return <Badge variant="success">Positive</Badge>;
      case "negative":
        return <Badge variant="destructive">Negative</Badge>;
      case "neutral":
        return <Badge variant="secondary">Neutral</Badge>;
      default:
        return <Badge>{outcome}</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/outbound/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Logs</h1>
          <p className="text-muted-foreground">
            View all calls made for this campaign
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="answered">Answered</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={fetchCalls} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : calls.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {call.contact?.first_name || call.contact?.last_name
                                ? `${call.contact?.first_name || ""} ${call.contact?.last_name || ""}`.trim()
                                : "Unknown"}
                            </div>
                            {call.contact?.email && (
                              <div className="text-xs text-muted-foreground">{call.contact.email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell>{getOutcomeBadge(call.outcome) || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>${call.cost || "0.00"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(call.created_at), "MMM d, h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectCall(call)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No calls yet</h3>
              <p className="text-muted-foreground text-center">
                Calls will appear here once the campaign starts making calls
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Detail Modal */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              {selectedCall && format(new Date(selectedCall.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-6">
              {/* Call Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <p className="font-mono">{selectedCall.phone_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact</label>
                  <p>
                    {selectedCall.contact?.first_name || selectedCall.contact?.last_name
                      ? `${selectedCall.contact?.first_name || ""} ${selectedCall.contact?.last_name || ""}`.trim()
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedCall.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Outcome</label>
                  <div className="mt-1">{getOutcomeBadge(selectedCall.outcome) || "—"}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Duration</label>
                  <p>{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cost</label>
                  <p>${selectedCall.cost || "0.00"}</p>
                </div>
              </div>

              {/* Recording */}
              {selectedCall.recording_url && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Recording</label>
                  <div className="mt-2">
                    <audio controls className="w-full">
                      <source src={selectedCall.recording_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.transcript && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transcript</label>
                  <div className="mt-2 p-4 bg-muted rounded-lg max-h-60 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{selectedCall.transcript}</pre>
                  </div>
                </div>
              )}

              {/* Structured Data */}
              {selectedCall.structured_data && Object.keys(selectedCall.structured_data).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Collected Data</label>
                  <div className="mt-2 p-4 bg-muted rounded-lg">
                    <dl className="space-y-2">
                      {Object.entries(selectedCall.structured_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</dt>
                          <dd className="font-medium">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}

              {/* SMS Logs Section */}
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS Messages
                </label>
                <div className="mt-2">
                  {smsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : smsLogs.length > 0 ? (
                    <div className="space-y-3">
                      {smsLogs.map((sms) => (
                        <div key={sms.id} className="border rounded-lg p-4 space-y-3">
                          {/* SMS Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getSmsStatusBadge(sms.status, sms.twilioStatus)}
                              {sms.ruleName && (
                                <span className="text-xs text-muted-foreground">
                                  via {sms.ruleName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {sms.sentAt ? format(new Date(sms.sentAt), "MMM d, h:mm a") : "Pending"}
                            </div>
                          </div>

                          {/* Delivered Banner */}
                          {sms.twilioStatus === "delivered" && sms.deliveredAt && (
                            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 px-3 py-2 rounded">
                              <CheckCircle2 className="h-3 w-3" />
                              Delivered {formatDistanceToNow(new Date(sms.deliveredAt), { addSuffix: true })}
                            </div>
                          )}

                          {/* Undelivered Warning */}
                          {sms.twilioStatus === "undelivered" && (
                            <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400 px-3 py-2 rounded">
                              <AlertTriangle className="h-3 w-3" />
                              Message could not be delivered to carrier
                            </div>
                          )}

                          {/* Message Body */}
                          <div className="bg-muted/50 rounded p-3">
                            <p className="text-sm whitespace-pre-wrap">{sms.messageBody}</p>
                          </div>

                          {/* SMS Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium">To:</span> {sms.phoneNumber}
                              {sms.recipientName && ` (${sms.recipientName})`}
                            </div>
                            {sms.segmentCount && (
                              <div>
                                <span className="font-medium">Segments:</span> {sms.segmentCount}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No SMS messages for this call</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

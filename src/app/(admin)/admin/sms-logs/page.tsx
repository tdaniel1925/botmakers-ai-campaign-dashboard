"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";

interface SmsLogWithRelations {
  id: string;
  campaign_id: string | null;
  call_id: string | null;
  rule_id: string | null;
  client_id: string | null;
  recipient_phone: string;
  message_body: string;
  twilio_message_sid: string | null;
  twilio_status: string | null;
  twilio_error_code: string | null;
  twilio_error_message: string | null;
  status: string;
  segment_count: number | null;
  cost: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  campaigns?: { name: string } | null;
  clients?: { name: string; company_name: string | null } | null;
  sms_rules?: { name: string } | null;
}

export default function SmsLogsPage() {
  const [logs, setLogs] = useState<SmsLogWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
  });
  const { toast } = useToast();
  const supabase = createClient();

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("sms_logs")
        .select(`
          *,
          campaigns (name),
          clients (name, company_name),
          sms_rules (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchQuery) {
        query = query.or(`recipient_phone.ilike.%${searchQuery}%,message_body.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);

      // Calculate stats
      const all = data || [];
      setStats({
        total: all.length,
        sent: all.filter((l) => l.status === "sent").length,
        delivered: all.filter((l) => l.status === "delivered").length,
        failed: all.filter((l) => l.status === "failed").length,
        pending: all.filter((l) => l.status === "pending").length,
      });
    } catch (error) {
      console.error("Error fetching SMS logs:", error);
      toast({
        title: "Error",
        description: "Failed to load SMS logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

  const handleSearch = () => {
    fetchLogs();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Delivered
          </Badge>
        );
      case "sent":
        return (
          <Badge className="bg-blue-500">
            <Send className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPhone = (phone: string) => {
    // Format US phone numbers nicely
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SMS Logs</h1>
        <p className="text-muted-foreground">
          View all SMS messages sent from your campaigns
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Delivered</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.delivered}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{stats.sent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-gray-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="mr-2 h-5 w-5" />
            SMS History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhone(log.recipient_phone)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm" title={log.message_body}>
                          {log.message_body}
                        </p>
                        {log.twilio_error_message && (
                          <p className="text-xs text-red-500 mt-1">
                            {log.twilio_error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.campaigns ? (
                          <Link
                            href={`/admin/campaigns/${log.campaign_id}`}
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            {log.campaigns.name}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.clients ? (
                          <span>{log.clients.name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.sent_at ? (
                          <span title={format(new Date(log.sent_at), "PPpp")}>
                            {formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}
                          </span>
                        ) : (
                          <span title={format(new Date(log.created_at), "PPpp")}>
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.cost ? (
                          <span className="text-sm font-mono">
                            ${parseFloat(log.cost).toFixed(4)}
                          </span>
                        ) : log.segment_count ? (
                          <span className="text-xs text-muted-foreground">
                            {log.segment_count} seg
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No SMS messages found</p>
              <p className="text-sm">
                SMS messages will appear here when campaigns trigger them
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

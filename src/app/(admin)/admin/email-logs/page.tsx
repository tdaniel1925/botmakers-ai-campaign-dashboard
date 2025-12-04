"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Mail,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
}

interface EmailLog {
  id: string;
  client_id: string | null;
  template_slug: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  resend_message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
  client: Client | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    icon: <Clock className="h-3 w-3" />,
  },
  sent: {
    label: "Sent",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  delivered: {
    label: "Delivered",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    icon: <XCircle className="h-3 w-3" />,
  },
  bounced: {
    label: "Bounced",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const templateLabels: Record<string, string> = {
  welcome: "Welcome Email",
  campaign_report: "Campaign Report",
  password_reset: "Password Reset",
  re_invite: "Re-invite",
};

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch logs
  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (templateFilter && templateFilter !== "all") params.append("template", templateFilter);

      const response = await fetch(`/api/admin/email-logs?${params}`);
      const data = await response.json();

      if (data.logs) {
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, templateFilter, pagination.limit]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchLogs(1);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [search, statusFilter, templateFilter, fetchLogs]);

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getTemplateLabel = (slug: string) => {
    return templateLabels[slug] || slug;
  };

  const viewDetails = (log: EmailLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  // Calculate stats
  const stats = {
    total: pagination.total,
    sent: logs.filter((l) => l.status === "sent" || l.status === "delivered").length,
    failed: logs.filter((l) => l.status === "failed" || l.status === "bounced").length,
    pending: logs.filter((l) => l.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Logs</h1>
          <p className="text-muted-foreground">
            View all sent emails and their delivery status
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchLogs(pagination.page)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Emails</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-sm text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2 dark:bg-yellow-900">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                <SelectItem value="welcome">Welcome Email</SelectItem>
                <SelectItem value="campaign_report">Campaign Report</SelectItem>
                <SelectItem value="password_reset">Password Reset</SelectItem>
                <SelectItem value="re_invite">Re-invite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Email History</CardTitle>
          <CardDescription>
            Showing {logs.length} of {pagination.total} emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No email logs found</p>
              <p className="text-sm text-muted-foreground">
                {search || statusFilter !== "all" || templateFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Emails will appear here once sent"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-muted p-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {log.recipient_name || "Unknown"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {log.recipient_email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTemplateLabel(log.template_slug)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {log.subject}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(log.sent_at || log.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </DialogTitle>
            <DialogDescription>
              Full details for this email log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`rounded-lg p-4 ${
                  selectedLog.status === "sent" || selectedLog.status === "delivered"
                    ? "bg-green-50 dark:bg-green-950"
                    : selectedLog.status === "failed" || selectedLog.status === "bounced"
                    ? "bg-red-50 dark:bg-red-950"
                    : "bg-yellow-50 dark:bg-yellow-950"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedLog.status)}
                    <span className="text-sm">
                      {selectedLog.status === "sent" || selectedLog.status === "delivered"
                        ? "Email was successfully delivered"
                        : selectedLog.status === "failed" || selectedLog.status === "bounced"
                        ? "Email delivery failed"
                        : "Email is pending delivery"}
                    </span>
                  </div>
                  {selectedLog.resend_message_id && (
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={`https://resend.com/emails/${selectedLog.resend_message_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View in Resend
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {selectedLog.error_message && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Error Message
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    {selectedLog.error_message}
                  </p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Recipient</p>
                  <p className="font-medium">{selectedLog.recipient_name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{selectedLog.recipient_email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Client</p>
                  {selectedLog.client ? (
                    <>
                      <p className="font-medium">{selectedLog.client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedLog.client.company_name}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">-</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Template</p>
                  <Badge variant="outline">{getTemplateLabel(selectedLog.template_slug)}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{selectedLog.subject}</p>
              </div>

              {selectedLog.resend_message_id && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Resend Message ID</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedLog.resend_message_id}
                  </code>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Metadata</p>
                  <pre className="text-sm bg-muted p-3 rounded overflow-y-auto overflow-x-hidden max-h-[150px] whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

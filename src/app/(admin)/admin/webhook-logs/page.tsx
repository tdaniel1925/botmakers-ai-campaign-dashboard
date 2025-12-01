import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function WebhookLogsPage() {
  const supabase = await createClient();

  const { data: logs, error } = await supabase
    .from("webhook_logs")
    .select(
      `
      *,
      campaigns (
        name,
        clients (
          name
        )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching logs:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Webhook Logs</h1>
        <p className="text-muted-foreground">
          View recent webhook deliveries and their status
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    {(log.campaigns as { name: string } | null)?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {(log.campaigns as { clients?: { name: string } } | null)?.clients?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {log.status === "success" ? (
                      <Badge variant="success">Success</Badge>
                    ) : log.status === "processing" ? (
                      <Badge variant="secondary">Processing</Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.error_message || "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No webhook logs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

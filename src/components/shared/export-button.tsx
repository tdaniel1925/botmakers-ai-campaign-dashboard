"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { downloadCSV, downloadExcel } from "@/lib/export";

interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined);
  format?: (value: unknown) => string;
}

interface ExportButtonProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  sheetName?: string;
  className?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton<T>({
  data,
  columns,
  filename,
  sheetName,
  className,
  disabled,
  variant = "outline",
  size = "sm",
}: ExportButtonProps<T>) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "csv" | "excel") => {
    setIsExporting(true);
    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (format === "csv") {
        downloadCSV(data, columns, filename);
      } else {
        downloadExcel(data, columns, filename, sheetName);
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (data.length === 0) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || isExporting} className={className}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Pre-configured export for calls
interface Call {
  id: string;
  phoneNumber?: string;
  callerName?: string;
  duration?: number;
  status?: string;
  outcome?: string;
  sentiment?: string;
  createdAt?: string;
}

export function ExportCallsButton({
  calls,
  filename = "calls-export",
}: {
  calls: Call[];
  filename?: string;
}) {
  const columns: ExportColumn<Call>[] = [
    { header: "ID", accessor: "id" },
    { header: "Phone Number", accessor: "phoneNumber" },
    { header: "Caller Name", accessor: "callerName" },
    {
      header: "Duration",
      accessor: "duration",
      format: (v) => {
        const secs = v as number;
        if (!secs) return "";
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        return `${mins}:${s.toString().padStart(2, "0")}`;
      },
    },
    { header: "Status", accessor: "status" },
    { header: "Outcome", accessor: "outcome" },
    { header: "Sentiment", accessor: "sentiment" },
    {
      header: "Date",
      accessor: "createdAt",
      format: (v) => (v ? new Date(v as string).toLocaleString() : ""),
    },
  ];

  return (
    <ExportButton
      data={calls}
      columns={columns}
      filename={filename}
      sheetName="Calls"
    />
  );
}

// Pre-configured export for clients
interface Client {
  id: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  status?: string;
  createdAt?: string;
}

export function ExportClientsButton({
  clients,
  filename = "clients-export",
}: {
  clients: Client[];
  filename?: string;
}) {
  const columns: ExportColumn<Client>[] = [
    { header: "ID", accessor: "id" },
    { header: "Company Name", accessor: "companyName" },
    { header: "Contact Name", accessor: "contactName" },
    { header: "Email", accessor: "email" },
    { header: "Status", accessor: "status" },
    {
      header: "Created",
      accessor: "createdAt",
      format: (v) => (v ? new Date(v as string).toLocaleDateString() : ""),
    },
  ];

  return (
    <ExportButton
      data={clients}
      columns={columns}
      filename={filename}
      sheetName="Clients"
    />
  );
}

// Pre-configured export for campaigns
interface Campaign {
  id: string;
  name?: string;
  status?: string;
  totalCalls?: number;
  completedCalls?: number;
  successRate?: number;
  createdAt?: string;
}

export function ExportCampaignsButton({
  campaigns,
  filename = "campaigns-export",
}: {
  campaigns: Campaign[];
  filename?: string;
}) {
  const columns: ExportColumn<Campaign>[] = [
    { header: "ID", accessor: "id" },
    { header: "Name", accessor: "name" },
    { header: "Status", accessor: "status" },
    { header: "Total Calls", accessor: "totalCalls" },
    { header: "Completed Calls", accessor: "completedCalls" },
    {
      header: "Success Rate",
      accessor: "successRate",
      format: (v) => (v !== undefined ? `${(v as number).toFixed(1)}%` : ""),
    },
    {
      header: "Created",
      accessor: "createdAt",
      format: (v) => (v ? new Date(v as string).toLocaleDateString() : ""),
    },
  ];

  return (
    <ExportButton
      data={campaigns}
      columns={columns}
      filename={filename}
      sheetName="Campaigns"
    />
  );
}

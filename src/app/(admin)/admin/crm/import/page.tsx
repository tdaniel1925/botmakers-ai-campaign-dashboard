"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
}

interface ParsedContact {
  [key: string]: string;
}

interface ImportResult {
  success: boolean;
  job_id: string;
  results: {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  };
}

const FIELD_OPTIONS = [
  { value: "", label: "Skip this column" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "job_title", label: "Job Title" },
  { value: "lead_source", label: "Lead Source" },
  { value: "tags", label: "Tags (comma-separated)" },
  { value: "notes", label: "Notes" },
];

export default function ImportContactsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [step, setStep] = useState<"upload" | "mapping" | "importing" | "results">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState("skip");
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/admin/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch {
      console.error("Error fetching clients");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedClient) {
      toast({
        title: "Error",
        description: "Please select a client first",
        variant: "destructive",
      });
      return;
    }

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Error",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await file.text();
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV file must have a header row and at least one data row",
          variant: "destructive",
        });
        return;
      }

      // Parse headers
      const csvHeaders = parseCSVLine(lines[0]);
      setHeaders(csvHeaders);

      // Auto-map fields based on header names
      const autoMapping: Record<string, string> = {};
      csvHeaders.forEach((header) => {
        const lowerHeader = header.toLowerCase().trim();
        if (lowerHeader.includes("first") && lowerHeader.includes("name")) {
          autoMapping[header] = "first_name";
        } else if (lowerHeader.includes("last") && lowerHeader.includes("name")) {
          autoMapping[header] = "last_name";
        } else if (lowerHeader === "email" || lowerHeader.includes("email")) {
          autoMapping[header] = "email";
        } else if (lowerHeader === "phone" || lowerHeader.includes("phone")) {
          autoMapping[header] = "phone";
        } else if (lowerHeader === "company" || lowerHeader.includes("company")) {
          autoMapping[header] = "company";
        } else if (lowerHeader.includes("title") || lowerHeader.includes("job")) {
          autoMapping[header] = "job_title";
        } else if (lowerHeader.includes("source")) {
          autoMapping[header] = "lead_source";
        } else if (lowerHeader.includes("tag")) {
          autoMapping[header] = "tags";
        } else if (lowerHeader.includes("note")) {
          autoMapping[header] = "notes";
        }
      });
      setFieldMapping(autoMapping);

      // Parse data rows (limit preview to 100 rows)
      const contacts: ParsedContact[] = [];
      for (let i = 1; i < Math.min(lines.length, 101); i++) {
        const values = parseCSVLine(lines[i]);
        const contact: ParsedContact = {};
        csvHeaders.forEach((header, index) => {
          contact[header] = values[index] || "";
        });
        contacts.push(contact);
      }
      setParsedContacts(contacts);

      // Store full data for import
      const fullContacts: ParsedContact[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const contact: ParsedContact = {};
        csvHeaders.forEach((header, index) => {
          contact[header] = values[index] || "";
        });
        fullContacts.push(contact);
      }
      setParsedContacts(fullContacts);

      setStep("mapping");
    } catch {
      toast({
        title: "Error",
        description: "Failed to parse CSV file",
        variant: "destructive",
      });
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleMappingChange = (header: string, value: string) => {
    setFieldMapping({ ...fieldMapping, [header]: value });
  };

  const handleImport = async () => {
    // Validate mapping
    const hasEmailOrPhone =
      Object.values(fieldMapping).includes("email") ||
      Object.values(fieldMapping).includes("phone");

    if (!hasEmailOrPhone) {
      toast({
        title: "Error",
        description: "You must map at least one column to Email or Phone",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setStep("importing");

    try {
      // Transform contacts based on mapping
      const transformedContacts = parsedContacts.map((contact) => {
        const mapped: Record<string, string> = {};
        for (const [header, field] of Object.entries(fieldMapping)) {
          if (field && contact[header]) {
            mapped[field] = contact[header];
          }
        }
        return mapped;
      });

      const response = await fetch("/api/admin/crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient,
          contacts: transformedContacts,
          duplicate_handling: duplicateHandling,
          field_mapping: fieldMapping,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult(result);
        setStep("results");
      } else {
        toast({
          title: "Error",
          description: result.error || "Import failed",
          variant: "destructive",
        });
        setStep("mapping");
      }
    } catch {
      toast({
        title: "Error",
        description: "Import failed",
        variant: "destructive",
      });
      setStep("mapping");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/crm">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Contacts</h1>
          <p className="text-muted-foreground">
            Import contacts from a CSV file
          </p>
        </div>
      </div>

      {step === "upload" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Select a client and upload your CSV file with contact data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">CSV File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={!selectedClient}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CSV Format</CardTitle>
              <CardDescription>
                Your CSV should have a header row with column names
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p>Required fields (at least one):</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>Email</li>
                  <li>Phone</li>
                </ul>
              </div>
              <div className="text-sm space-y-2">
                <p>Optional fields:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>First Name, Last Name</li>
                  <li>Company, Job Title</li>
                  <li>Lead Source, Tags, Notes</li>
                </ul>
              </div>
              <div className="p-3 bg-muted rounded-lg text-sm font-mono">
                first_name,last_name,email,phone,company<br />
                John,Doe,john@example.com,+15551234567,Acme Inc
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "mapping" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Map Fields</CardTitle>
              <CardDescription>
                Match your CSV columns to contact fields. Found {parsedContacts.length} contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {headers.map((header) => (
                  <div key={header} className="space-y-2">
                    <Label className="text-muted-foreground">{header}</Label>
                    <Select
                      value={fieldMapping[header] || ""}
                      onValueChange={(value) => handleMappingChange(header, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Duplicate Handling</Label>
                <Select value={duplicateHandling} onValueChange={setDuplicateHandling}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="update">Update existing contacts</SelectItem>
                    <SelectItem value="create_new">Create as new contacts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview (First 5 Rows)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHead key={header}>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">{header}</div>
                            <div className="text-xs font-medium">
                              {fieldMapping[header] ? `→ ${fieldMapping[header]}` : "(skipped)"}
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedContacts.slice(0, 5).map((contact, index) => (
                      <TableRow key={index}>
                        {headers.map((header) => (
                          <TableCell key={header} className="text-sm">
                            {contact[header] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Import {parsedContacts.length} Contacts
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
            <h3 className="text-lg font-medium">Importing contacts...</h3>
            <p className="text-muted-foreground">
              This may take a moment for large files
            </p>
          </CardContent>
        </Card>
      )}

      {step === "results" && importResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.results.imported}
                  </div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {importResult.results.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {importResult.results.skipped}
                  </div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {importResult.results.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {importResult.results.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Errors ({importResult.results.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.results.errors.slice(0, 50).map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell className="text-red-600">{error.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importResult.results.errors.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Showing first 50 errors
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => {
              setStep("upload");
              setParsedContacts([]);
              setHeaders([]);
              setFieldMapping({});
              setImportResult(null);
            }}>
              Import More
            </Button>
            <Link href="/admin/crm">
              <Button>View Contacts</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

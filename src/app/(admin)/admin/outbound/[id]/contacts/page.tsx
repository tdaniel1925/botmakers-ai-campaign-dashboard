"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  Phone,
  User,
  Mail,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  Settings,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// File size limit: 1GB
const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const MAX_FILE_SIZE_DISPLAY = "1 GB";

// US area code to timezone mapping (simplified for common cases)
const AREA_CODE_TIMEZONE: Record<string, string> = {
  // Eastern
  "201": "America/New_York", "202": "America/New_York", "203": "America/New_York",
  "212": "America/New_York", "215": "America/New_York", "216": "America/New_York",
  "267": "America/New_York", "301": "America/New_York", "302": "America/New_York",
  "304": "America/New_York", "305": "America/New_York", "315": "America/New_York",
  "332": "America/New_York", "347": "America/New_York", "404": "America/New_York",
  "407": "America/New_York", "410": "America/New_York", "412": "America/New_York",
  "470": "America/New_York", "516": "America/New_York", "518": "America/New_York",
  "561": "America/New_York", "570": "America/New_York", "585": "America/New_York",
  "610": "America/New_York", "614": "America/New_York", "617": "America/New_York",
  "631": "America/New_York", "678": "America/New_York", "704": "America/New_York",
  "716": "America/New_York", "718": "America/New_York", "727": "America/New_York",
  "754": "America/New_York", "757": "America/New_York", "772": "America/New_York",
  "774": "America/New_York", "786": "America/New_York", "803": "America/New_York",
  "804": "America/New_York", "813": "America/New_York", "843": "America/New_York",
  "845": "America/New_York", "856": "America/New_York", "862": "America/New_York",
  "863": "America/New_York", "864": "America/New_York", "904": "America/New_York",
  "908": "America/New_York", "914": "America/New_York", "919": "America/New_York",
  "941": "America/New_York", "954": "America/New_York", "973": "America/New_York",
  "980": "America/New_York",
  // Central
  "205": "America/Chicago", "210": "America/Chicago", "214": "America/Chicago",
  "217": "America/Chicago", "224": "America/Chicago", "225": "America/Chicago",
  "251": "America/Chicago", "254": "America/Chicago", "256": "America/Chicago",
  "262": "America/Chicago", "281": "America/Chicago", "309": "America/Chicago",
  "312": "America/Chicago", "314": "America/Chicago", "316": "America/Chicago",
  "318": "America/Chicago", "319": "America/Chicago", "320": "America/Chicago",
  "334": "America/Chicago", "361": "America/Chicago", "405": "America/Chicago",
  "409": "America/Chicago", "414": "America/Chicago", "417": "America/Chicago",
  "430": "America/Chicago", "432": "America/Chicago", "469": "America/Chicago",
  "479": "America/Chicago", "501": "America/Chicago", "504": "America/Chicago",
  "512": "America/Chicago", "513": "America/Chicago", "515": "America/Chicago",
  "563": "America/Chicago", "573": "America/Chicago", "580": "America/Chicago",
  "601": "America/Chicago", "612": "America/Chicago", "615": "America/Chicago",
  "618": "America/Chicago", "630": "America/Chicago", "636": "America/Chicago",
  "651": "America/Chicago", "662": "America/Chicago", "682": "America/Chicago",
  "708": "America/Chicago", "713": "America/Chicago", "715": "America/Chicago",
  "731": "America/Chicago", "737": "America/Chicago", "763": "America/Chicago",
  "769": "America/Chicago", "773": "America/Chicago", "779": "America/Chicago",
  "806": "America/Chicago", "816": "America/Chicago", "817": "America/Chicago",
  "830": "America/Chicago", "832": "America/Chicago", "847": "America/Chicago",
  "870": "America/Chicago", "901": "America/Chicago", "903": "America/Chicago",
  "913": "America/Chicago", "918": "America/Chicago", "920": "America/Chicago",
  "936": "America/Chicago", "940": "America/Chicago", "952": "America/Chicago",
  "956": "America/Chicago", "972": "America/Chicago", "979": "America/Chicago",
  // Mountain
  "303": "America/Denver", "307": "America/Denver", "385": "America/Denver",
  "406": "America/Denver", "435": "America/Denver", "480": "America/Denver",
  "505": "America/Denver", "520": "America/Denver", "575": "America/Denver",
  "602": "America/Denver", "623": "America/Denver", "719": "America/Denver",
  "720": "America/Denver", "801": "America/Denver", "928": "America/Denver",
  "970": "America/Denver",
  // Pacific
  "206": "America/Los_Angeles", "209": "America/Los_Angeles", "213": "America/Los_Angeles",
  "253": "America/Los_Angeles", "310": "America/Los_Angeles", "323": "America/Los_Angeles",
  "360": "America/Los_Angeles", "408": "America/Los_Angeles", "415": "America/Los_Angeles",
  "424": "America/Los_Angeles", "425": "America/Los_Angeles", "442": "America/Los_Angeles",
  "503": "America/Los_Angeles", "509": "America/Los_Angeles", "510": "America/Los_Angeles",
  "530": "America/Los_Angeles", "541": "America/Los_Angeles", "559": "America/Los_Angeles",
  "562": "America/Los_Angeles", "619": "America/Los_Angeles", "626": "America/Los_Angeles",
  "650": "America/Los_Angeles", "657": "America/Los_Angeles", "661": "America/Los_Angeles",
  "669": "America/Los_Angeles", "702": "America/Los_Angeles", "707": "America/Los_Angeles",
  "714": "America/Los_Angeles", "725": "America/Los_Angeles", "747": "America/Los_Angeles",
  "760": "America/Los_Angeles", "775": "America/Los_Angeles", "805": "America/Los_Angeles",
  "818": "America/Los_Angeles", "831": "America/Los_Angeles", "858": "America/Los_Angeles",
  "909": "America/Los_Angeles", "916": "America/Los_Angeles", "925": "America/Los_Angeles",
  "949": "America/Los_Angeles", "951": "America/Los_Angeles", "971": "America/Los_Angeles",
  // Alaska
  "907": "America/Anchorage",
  // Hawaii
  "808": "Pacific/Honolulu",
};

interface Contact {
  id: string;
  campaign_id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  timezone: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  outcome: "positive" | "negative" | "neutral" | null;
  call_attempts: number;
  last_called_at: string | null;
  created_at: string;
}

interface ColumnMapping {
  phone_number: string;
  first_name: string;
  last_name: string;
  full_name: string; // For CSVs with a single name column
  email: string;
  timezone: string;
}

interface VariableMapping {
  csv_column: string;
  variable_name: string;
}

// Provider-specific variable info
const PROVIDER_VARIABLE_INFO = {
  vapi: {
    name: "Vapi",
    description: "Variables are passed to the assistant via assistantOverrides.variableValues",
    format: "key: value (JSON object)",
    examples: ["company_name", "appointment_date", "product_name"],
  },
  autocalls: {
    name: "AutoCalls.ai",
    description: "Variables are passed in the 'variables' object when making calls",
    format: "key: value (JSON object)",
    examples: ["company", "interest", "callback_time"],
  },
  synthflow: {
    name: "Synthflow",
    description: "Variables are passed as custom_variables array in 'Key: Value' format",
    format: "Key: Value (array of strings)",
    examples: ["Company", "Product", "Meeting_Date"],
  },
};

interface UploadReport {
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ row: number; phone: string; error: string }>;
  timezonesAppended: number;
}

export default function ContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAllMode, setSelectAllMode] = useState<"page" | "all" | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Add contact modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    phone_number: "",
    first_name: "",
    last_name: "",
    email: "",
  });
  const [isAdding, setIsAdding] = useState(false);

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState<"upload" | "mapping" | "processing" | "complete">("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    phone_number: "",
    first_name: "",
    last_name: "",
    full_name: "",
    email: "",
    timezone: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadReport, setUploadReport] = useState<UploadReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Variable mapping for provider
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);
  const [campaignProvider, setCampaignProvider] = useState<"vapi" | "autocalls" | "synthflow" | null>(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  // Fetch campaign to get provider info
  useEffect(() => {
    async function fetchCampaignProvider() {
      try {
        const response = await fetch(`/api/admin/outbound-campaigns/${id}`);
        if (response.ok) {
          const campaign = await response.json();
          setCampaignProvider(campaign.call_provider || null);
        }
      } catch (error) {
        console.error("Error fetching campaign:", error);
      }
    }
    fetchCampaignProvider();
  }, [id]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/admin/outbound-campaigns/${id}/contacts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch contacts");
      const data = await response.json();
      setContacts(data.contacts || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast({
        title: "Error",
        description: "Failed to load contacts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [id, pagination.page, statusFilter, outcomeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchContacts();
  };

  const handleAddContact = async () => {
    if (!addFormData.phone_number) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addFormData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add contact");
      }

      toast({
        title: "Contact Added",
        description: "Contact has been added to the campaign",
      });

      setShowAddModal(false);
      setAddFormData({ phone_number: "", first_name: "", last_name: "", email: "" });
      fetchContacts();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add contact",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: `Maximum file size is ${MAX_FILE_SIZE_DISPLAY}. Your file is ${formatFileSize(file.size)}.`,
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);

    // Parse CSV properly handling quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          // Toggle quote state
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      // Don't forget the last field
      result.push(current.trim());
      return result;
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Handle different line endings (Windows \r\n, Mac \r, Unix \n)
      const lines = text.split(/\r?\n|\r/);
      if (lines.length > 0) {
        const headers = parseCSVLine(lines[0]);
        setCsvHeaders(headers);

        // Parse all data rows
        const allData: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => {
              row[h] = values[idx] || "";
            });
            allData.push(row);
          }
        }
        setCsvData(allData);
        setCsvPreview(allData.slice(0, 5));

        // Auto-map common column names with comprehensive pattern matching
        const autoMapping: ColumnMapping = {
          phone_number: "",
          first_name: "",
          last_name: "",
          full_name: "",
          email: "",
          timezone: "",
        };

        // Normalize header for matching (lowercase, remove spaces/underscores/dashes)
        const normalizeHeader = (h: string) => h.toLowerCase().replace(/[\s_-]/g, "");

        headers.forEach((h) => {
          const lower = h.toLowerCase();
          const normalized = normalizeHeader(h);

          // Phone number patterns
          if (!autoMapping.phone_number) {
            const phonePatterns = ["phone", "phonenumber", "mobile", "cell", "telephone", "tel", "number", "contact"];
            if (phonePatterns.some(p => normalized.includes(p)) || lower === "phone" || lower === "mobile") {
              autoMapping.phone_number = h;
            }
          }

          // First name patterns (must check before generic "name")
          if (!autoMapping.first_name) {
            const firstNamePatterns = ["firstname", "first", "fname", "givenname", "given"];
            if (firstNamePatterns.some(p => normalized === p || normalized.startsWith(p))) {
              autoMapping.first_name = h;
            }
          }

          // Last name patterns
          if (!autoMapping.last_name) {
            const lastNamePatterns = ["lastname", "last", "lname", "surname", "familyname", "family"];
            if (lastNamePatterns.some(p => normalized === p || normalized.startsWith(p))) {
              autoMapping.last_name = h;
            }
          }

          // Full name patterns (single column with full name)
          if (!autoMapping.full_name && !autoMapping.first_name && !autoMapping.last_name) {
            const fullNamePatterns = ["fullname", "name", "contactname", "customername", "personname"];
            if (fullNamePatterns.some(p => normalized === p)) {
              autoMapping.full_name = h;
            }
          }

          // Email patterns
          if (!autoMapping.email) {
            const emailPatterns = ["email", "emailaddress", "mail", "emailid"];
            if (emailPatterns.some(p => normalized.includes(p))) {
              autoMapping.email = h;
            }
          }

          // Timezone patterns
          if (!autoMapping.timezone) {
            const tzPatterns = ["timezone", "tz", "timez", "zone"];
            if (tzPatterns.some(p => normalized.includes(p))) {
              autoMapping.timezone = h;
            }
          }
        });

        setColumnMapping(autoMapping);

        setUploadStep("mapping");
      }
    };
    reader.readAsText(file);
  };

  // Get timezone from phone number area code
  const getTimezoneFromPhone = (phone: string): string | null => {
    const digits = phone.replace(/\D/g, "");
    let areaCode = "";

    if (digits.length === 10) {
      areaCode = digits.substring(0, 3);
    } else if (digits.length === 11 && digits.startsWith("1")) {
      areaCode = digits.substring(1, 4);
    }

    return AREA_CODE_TIMEZONE[areaCode] || null;
  };

  // Normalize phone number to E.164 format
  const normalizePhoneNumber = (phone: string): string | null => {
    if (!phone) return null;
    const digits = phone.toString().replace(/\D/g, "");

    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    } else if (digits.length >= 11 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  };

  const handleUpload = async () => {
    if (!csvFile || !columnMapping.phone_number || csvData.length === 0) {
      toast({
        title: "Error",
        description: "Please select a phone number column",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadStep("processing");
    setUploadProgress(0);
    setUploadStatus("Preparing contacts...");

    const report: UploadReport = {
      totalRows: csvData.length,
      imported: 0,
      duplicates: 0,
      invalid: 0,
      errors: [],
      timezonesAppended: 0,
    };

    try {
      // Process contacts with timezone appending
      setUploadStatus("Processing and appending timezones...");
      const processedContacts: Array<{
        phone_number: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        timezone?: string;
        custom_data: Record<string, unknown>;
      }> = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowNumber = i + 1;

        // Update progress for processing phase (0-30%)
        setUploadProgress(Math.floor((i / csvData.length) * 30));

        const rawPhone = row[columnMapping.phone_number] || "";
        const normalizedPhone = normalizePhoneNumber(rawPhone);

        if (!normalizedPhone) {
          report.invalid++;
          report.errors.push({
            row: rowNumber,
            phone: rawPhone,
            error: "Invalid phone number format",
          });
          continue;
        }

        // Get timezone from mapping or derive from phone
        let timezone = columnMapping.timezone ? row[columnMapping.timezone] : null;
        if (!timezone) {
          timezone = getTimezoneFromPhone(normalizedPhone);
          if (timezone) {
            report.timezonesAppended++;
          }
        }

        // Build custom data
        const standardFields = [
          columnMapping.phone_number,
          columnMapping.first_name,
          columnMapping.last_name,
          columnMapping.full_name,
          columnMapping.email,
          columnMapping.timezone,
        ].filter(Boolean);

        const customData: Record<string, unknown> = {};

        // Add variable mappings (renamed columns for provider)
        for (const mapping of variableMappings) {
          if (mapping.csv_column && mapping.variable_name && row[mapping.csv_column]) {
            customData[mapping.variable_name] = row[mapping.csv_column];
          }
        }

        // Add any remaining unmapped columns with their original names
        for (const [key, value] of Object.entries(row)) {
          if (!standardFields.includes(key) && value && !customData[key]) {
            // Check if this column is mapped to a variable
            const isVariableMapped = variableMappings.some(m => m.csv_column === key);
            if (!isVariableMapped) {
              customData[key] = value;
            }
          }
        }

        // Handle names - support both separate first/last and combined full name
        let firstName = columnMapping.first_name ? row[columnMapping.first_name] : undefined;
        let lastName = columnMapping.last_name ? row[columnMapping.last_name] : undefined;

        // If we have a full_name column but no separate first/last, split it
        if (columnMapping.full_name && row[columnMapping.full_name] && !firstName && !lastName) {
          const fullName = row[columnMapping.full_name].trim();
          const nameParts = fullName.split(/\s+/);
          if (nameParts.length >= 2) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(" ");
          } else if (nameParts.length === 1) {
            firstName = nameParts[0];
          }
        }

        processedContacts.push({
          phone_number: normalizedPhone,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          email: columnMapping.email ? row[columnMapping.email] : undefined,
          timezone: timezone || undefined,
          custom_data: customData,
        });
      }

      // Upload in batches with progress and retry logic
      const batchSize = 500;
      const totalBatches = Math.ceil(processedContacts.length / batchSize);
      const maxRetries = 3;

      setUploadStatus("Uploading contacts to server...");

      // Helper function for uploading a batch with retry
      const uploadBatchWithRetry = async (batch: typeof processedContacts, batchIndex: number): Promise<{ success: number; duplicates: number; failed: number; errors?: Array<{ row: number; phone: string; error: string }> }> => {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const response = await fetch(`/api/admin/outbound-campaigns/${id}/contacts/upload`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contacts: batch,
                column_mapping: columnMapping,
              }),
            });

            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || "Failed to upload batch");
            }

            const result = await response.json();
            return result.result;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error("Unknown error");

            // Don't retry on the last attempt
            if (attempt < maxRetries - 1) {
              // Exponential backoff: 1s, 2s, 4s
              const delay = Math.pow(2, attempt) * 1000;
              setUploadStatus(`Batch ${batchIndex + 1} failed, retrying in ${delay / 1000}s... (attempt ${attempt + 2}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        throw lastError || new Error("Failed to upload batch after retries");
      };

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = processedContacts.slice(
          batchIndex * batchSize,
          (batchIndex + 1) * batchSize
        );

        // Update progress for upload phase (30-90%)
        const uploadProgressPercent = 30 + Math.floor((batchIndex / totalBatches) * 60);
        setUploadProgress(uploadProgressPercent);
        setUploadStatus(`Uploading batch ${batchIndex + 1} of ${totalBatches}...`);

        const result = await uploadBatchWithRetry(batch, batchIndex);
        report.imported += result.success;
        report.duplicates += result.duplicates;
        report.invalid += result.failed;

        if (result.errors) {
          report.errors.push(...result.errors);
        }
      }

      setUploadProgress(100);
      setUploadStatus("Upload complete!");
      setUploadReport(report);
      setUploadStep("complete");

    } catch (error) {
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload contacts",
        variant: "destructive",
      });
      resetUpload();
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setCsvPreview([]);
    setColumnMapping({ phone_number: "", first_name: "", last_name: "", full_name: "", email: "", timezone: "" });
    setVariableMappings([]);
    setUploadStep("upload");
    setUploadProgress(0);
    setUploadStatus("");
    setUploadReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Variable mapping helpers
  const addVariableMapping = () => {
    setVariableMappings(prev => [...prev, { csv_column: "", variable_name: "" }]);
  };

  const removeVariableMapping = (index: number) => {
    setVariableMappings(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariableMapping = (index: number, field: "csv_column" | "variable_name", value: string) => {
    setVariableMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Get unmapped CSV columns (columns not used in standard mapping)
  const getUnmappedColumns = () => {
    const standardMapped = [
      columnMapping.phone_number,
      columnMapping.first_name,
      columnMapping.last_name,
      columnMapping.email,
      columnMapping.timezone,
    ].filter(Boolean);
    const variableMapped = variableMappings.map(m => m.csv_column).filter(Boolean);
    return csvHeaders.filter(h => !standardMapped.includes(h) && !variableMapped.includes(h));
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    resetUpload();
    if (uploadReport && uploadReport.imported > 0) {
      fetchContacts();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/contacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: selectedContacts }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete contacts");
      }

      const data = await response.json();
      toast({
        title: "Deleted",
        description: `${data.deleted_count} contacts removed`,
      });

      setShowDeleteModal(false);
      setSelectedContacts([]);
      fetchContacts();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete contacts",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    const pendingOnPage = contacts.filter((c) => c.status === "pending");
    if (selectedContacts.length === pendingOnPage.length && pendingOnPage.length > 0) {
      setSelectedContacts([]);
      setSelectAllMode(null);
    } else {
      setSelectedContacts(pendingOnPage.map((c) => c.id));
      setSelectAllMode("page");
    }
  };

  const handleSelectAllRecords = async () => {
    // Fetch all pending contact IDs for the campaign
    try {
      const params = new URLSearchParams({
        status: "pending",
        ids_only: "true",
      });
      if (statusFilter !== "all" && statusFilter !== "pending") {
        // If filtering by non-pending status, no pending contacts match
        setSelectedContacts([]);
        setSelectAllMode(null);
        return;
      }
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/admin/outbound-campaigns/${id}/contacts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch contact IDs");
      const data = await response.json();
      setSelectedContacts(data.contact_ids || []);
      setSelectAllMode("all");
    } catch (error) {
      console.error("Error fetching all contact IDs:", error);
      toast({
        title: "Error",
        description: "Failed to select all records",
        variant: "destructive",
      });
    }
  };

  const clearSelection = () => {
    setSelectedContacts([]);
    setSelectAllMode(null);
  };

  const toggleSelect = (contactId: string) => {
    setSelectAllMode(null); // Reset select all mode when manually toggling
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "in_progress":
        return <Badge variant="warning">In Progress</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/admin/outbound/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground">
              Manage campaign contact list
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload CSV
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, name, or email..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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
            <Button type="button" variant="outline" size="icon" onClick={fetchContacts} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-col gap-2 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectAllMode === "all"
                  ? `All ${selectedContacts.length.toLocaleString()} pending contact${selectedContacts.length !== 1 ? "s" : ""} selected`
                  : `${selectedContacts.length} contact${selectedContacts.length !== 1 ? "s" : ""} selected`}
              </span>
              {selectAllMode === "page" && pagination.total > contacts.length && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary"
                  onClick={handleSelectAllRecords}
                >
                  Select all {pagination.total.toLocaleString()} pending contacts
                </Button>
              )}
              {selectAllMode === "all" && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-muted-foreground"
                  onClick={clearSelection}
                >
                  Clear selection
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedContacts.length === contacts.filter((c) => c.status === "pending").length && contacts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Last Called</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => toggleSelect(contact.id)}
                          disabled={contact.status !== "pending"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {contact.first_name || contact.last_name
                                ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                                : "—"}
                            </div>
                            {contact.email && (
                              <div className="text-xs text-muted-foreground">{contact.email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{contact.phone_number}</TableCell>
                      <TableCell>
                        {contact.timezone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {contact.timezone.split("/").pop()?.replace("_", " ")}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(contact.status)}</TableCell>
                      <TableCell>{getOutcomeBadge(contact.outcome) || "—"}</TableCell>
                      <TableCell>{contact.call_attempts}</TableCell>
                      <TableCell>
                        {contact.last_called_at
                          ? formatDistanceToNow(new Date(contact.last_called_at), { addSuffix: true })
                          : "Never"}
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
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No contacts yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add contacts manually or upload a CSV file
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowUploadModal(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </Button>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Contact Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a single contact to the campaign
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                value={addFormData.phone_number}
                onChange={(e) => setAddFormData({ ...addFormData, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={addFormData.first_name}
                  onChange={(e) => setAddFormData({ ...addFormData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={addFormData.last_name}
                  onChange={(e) => setAddFormData({ ...addFormData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={addFormData.email}
                onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={isAdding}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload CSV Modal */}
      <Dialog open={showUploadModal} onOpenChange={(open) => { if (!open) handleCloseUploadModal(); else setShowUploadModal(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Contacts</DialogTitle>
            <DialogDescription>
              {uploadStep === "upload" && "Select a CSV file to upload (max 1GB)"}
              {uploadStep === "mapping" && "Map your CSV columns to contact fields"}
              {uploadStep === "processing" && "Processing and uploading contacts..."}
              {uploadStep === "complete" && "Upload complete!"}
            </DialogDescription>
          </DialogHeader>

          {/* Upload Step */}
          {uploadStep === "upload" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium mb-1">Click to select a CSV file</p>
                <p className="text-sm text-muted-foreground">
                  Maximum file size: {MAX_FILE_SIZE_DISPLAY}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Mapping Step */}
          {uploadStep === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-5 w-5" />
                <span className="font-medium">{csvFile?.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({formatFileSize(csvFile?.size || 0)}, {csvData.length} rows)
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number Column *</Label>
                  <Select
                    value={columnMapping.phone_number}
                    onValueChange={(value) => setColumnMapping({ ...columnMapping, phone_number: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name Column</Label>
                    <Select
                      value={columnMapping.first_name || "__none__"}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, first_name: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name Column</Label>
                    <Select
                      value={columnMapping.last_name || "__none__"}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, last_name: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Full Name option - only show if first/last not already mapped */}
                {!columnMapping.first_name && !columnMapping.last_name && (
                  <div className="space-y-2">
                    <Label>Full Name Column (optional)</Label>
                    <Select
                      value={columnMapping.full_name || "__none__"}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, full_name: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If your CSV has a single &quot;Name&quot; column, select it here. It will be split into first and last names.
                    </p>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email Column</Label>
                    <Select
                      value={columnMapping.email || "__none__"}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, email: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Timezone Column
                    </Label>
                    <Select
                      value={columnMapping.timezone || "__none__"}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, timezone: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-detect from phone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Auto-detect from phone —</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If not mapped, timezone will be detected from US phone area codes
                    </p>
                  </div>
                </div>
              </div>

              {/* Variable Mapping Section */}
              {getUnmappedColumns().length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Custom Variable Mapping
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Map CSV columns to provider variables for use during calls
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addVariableMapping}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Variable
                    </Button>
                  </div>

                  {/* Provider Info */}
                  {campaignProvider && PROVIDER_VARIABLE_INFO[campaignProvider] && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>{PROVIDER_VARIABLE_INFO[campaignProvider].name}:</strong>{" "}
                          {PROVIDER_VARIABLE_INFO[campaignProvider].description}
                          <div className="mt-1 text-xs">
                            Example variable names: {PROVIDER_VARIABLE_INFO[campaignProvider].examples.join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Variable Mapping List */}
                  {variableMappings.length > 0 && (
                    <div className="space-y-2">
                      {variableMappings.map((mapping, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Select
                            value={mapping.csv_column}
                            onValueChange={(value) => updateVariableMapping(index, "csv_column", value)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select CSV column" />
                            </SelectTrigger>
                            <SelectContent>
                              {getUnmappedColumns().map((col) => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))}
                              {mapping.csv_column && !getUnmappedColumns().includes(mapping.csv_column) && (
                                <SelectItem value={mapping.csv_column}>
                                  {mapping.csv_column}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground">→</span>
                          <Input
                            value={mapping.variable_name}
                            onChange={(e) => updateVariableMapping(index, "variable_name", e.target.value)}
                            placeholder="Variable name"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeVariableMapping(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unmapped Columns Info */}
                  {getUnmappedColumns().length > 0 && variableMappings.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Unmapped columns:</span>{" "}
                      {getUnmappedColumns().slice(0, 5).join(", ")}
                      {getUnmappedColumns().length > 5 && ` +${getUnmappedColumns().length - 5} more`}
                      <p className="text-xs mt-1">
                        These will be stored as custom data with their original column names.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview */}
              {csvPreview.length > 0 && columnMapping.phone_number && (
                <div className="space-y-2">
                  <Label>Preview (first 5 rows)</Label>
                  <div className="border rounded-lg overflow-auto max-h-40">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Phone</TableHead>
                          <TableHead>First Name</TableHead>
                          <TableHead>Last Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Timezone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {row[columnMapping.phone_number] || "—"}
                            </TableCell>
                            <TableCell>{row[columnMapping.first_name] || "—"}</TableCell>
                            <TableCell>{row[columnMapping.last_name] || "—"}</TableCell>
                            <TableCell>{row[columnMapping.email] || "—"}</TableCell>
                            <TableCell>
                              {columnMapping.timezone ? row[columnMapping.timezone] : (
                                <span className="text-muted-foreground italic">Auto-detect</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing Step */}
          {uploadStep === "processing" && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                <p className="font-medium">{uploadStatus}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-3" />
              </div>
              <div className="bg-muted rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Processing {csvData.length.toLocaleString()} contacts...</span>
                </div>
              </div>
            </div>
          )}

          {/* Complete Step - Final Report */}
          {uploadStep === "complete" && uploadReport && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold">Upload Complete!</h3>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{uploadReport.imported}</div>
                    <div className="text-sm text-muted-foreground">Imported</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{uploadReport.duplicates}</div>
                    <div className="text-sm text-muted-foreground">Duplicates</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{uploadReport.invalid}</div>
                    <div className="text-sm text-muted-foreground">Invalid</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{uploadReport.timezonesAppended}</div>
                    <div className="text-sm text-muted-foreground">TZ Added</div>
                  </CardContent>
                </Card>
              </div>

              {/* Details */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span>Total rows processed:</span>
                  <span className="font-medium">{uploadReport.totalRows.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Successfully imported:</span>
                  <span className="font-medium text-green-600">{uploadReport.imported.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duplicates skipped:</span>
                  <span className="font-medium text-yellow-600">{uploadReport.duplicates.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invalid/failed:</span>
                  <span className="font-medium text-red-600">{uploadReport.invalid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span>Timezones auto-detected:</span>
                  <span className="font-medium text-blue-600">{uploadReport.timezonesAppended.toLocaleString()}</span>
                </div>
              </div>

              {/* Errors */}
              {uploadReport.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Errors ({Math.min(uploadReport.errors.length, 10)} shown)
                  </Label>
                  <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-auto max-h-32">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadReport.errors.slice(0, 10).map((err, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{err.row}</TableCell>
                            <TableCell className="font-mono text-sm">{err.phone || "—"}</TableCell>
                            <TableCell className="text-red-600">{err.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {uploadReport.errors.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      ...and {uploadReport.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {uploadStep === "upload" && (
              <Button variant="outline" onClick={handleCloseUploadModal}>
                Cancel
              </Button>
            )}
            {uploadStep === "mapping" && (
              <>
                <Button variant="outline" onClick={resetUpload}>
                  Back
                </Button>
                <Button onClick={handleUpload} disabled={isUploading || !columnMapping.phone_number}>
                  {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {csvData.length.toLocaleString()} Contacts
                </Button>
              </>
            )}
            {uploadStep === "complete" && (
              <Button onClick={handleCloseUploadModal}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContacts.length} contact
              {selectedContacts.length > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

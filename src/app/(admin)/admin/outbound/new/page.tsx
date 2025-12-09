"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Building2,
  FileText,
  Key,
  Calendar,
  MessageSquare,
  DollarSign,
  Users,
  Play,
  Settings,
  Upload,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  TestTube,
  CheckCircle,
  Info,
  FileSpreadsheet,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Client {
  id: string;
  name: string;
  company_name: string | null;
}

interface WizardData {
  // Step 1: Client Selection
  client_id: string;
  // Step 2: Campaign Details
  name: string;
  description: string;
  // Step 3: Call Provider Configuration
  call_provider: "vapi" | "autocalls" | "synthflow";
  // Vapi-specific
  vapi_key_source: "system" | "client";
  vapi_api_key: string;
  vapi_assistant_id: string;
  vapi_phone_number_id: string;
  // AutoCalls-specific
  autocalls_key_source: "system" | "client";
  autocalls_api_key: string;
  autocalls_assistant_id: string;
  // Synthflow-specific
  synthflow_key_source: "system" | "client";
  synthflow_api_key: string;
  synthflow_model_id: string;
  // Step 4: Schedule
  schedule_days: number[];
  schedule_start_time: string;
  schedule_end_time: string;
  schedule_timezone: string;
  // Step 5: SMS Templates
  sms_templates: Array<{
    name: string;
    trigger_type: string;
    template_body: string;
    link_url: string;
  }>;
  // Step 6: Contact List (handled separately via upload)
  // Step 7: Retry Settings
  retry_enabled: boolean;
  retry_attempts: number;
  retry_delay_minutes: number;
  max_concurrent_calls: number;
  calls_per_minute: number;
  // Step 8: Billing
  rate_per_minute: string;
  billing_threshold: string;
  // Step 9: Review & Launch
  is_test_mode: boolean;
  test_call_limit: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

// Friendly timezone names
const TIMEZONE_DISPLAY_NAMES: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Phoenix": "Arizona",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
  "Unknown": "Unknown",
};

function getTimezoneFriendlyName(tz: string): string {
  return TIMEZONE_DISPLAY_NAMES[tz] || tz.replace("America/", "").replace("Pacific/", "").replace("_", " ");
}

const SMS_TRIGGER_TYPES = [
  { value: "call_completed", label: "After Call Completed" },
  { value: "positive_outcome", label: "Positive Outcome" },
  { value: "negative_outcome", label: "Negative Outcome" },
  { value: "no_answer", label: "No Answer" },
  { value: "voicemail", label: "Left Voicemail" },
];

const STEPS = [
  { id: 1, title: "Client", icon: Building2 },
  { id: 2, title: "Details", icon: FileText },
  { id: 3, title: "Call Provider", icon: Key },
  { id: 4, title: "Schedule", icon: Calendar },
  { id: 5, title: "SMS", icon: MessageSquare },
  { id: 6, title: "Contacts", icon: Users },
  { id: 7, title: "Retry", icon: Settings },
  { id: 8, title: "Billing", icon: DollarSign },
  { id: 9, title: "Review", icon: Play },
];

const CALL_PROVIDERS = [
  { value: "vapi", label: "Vapi", description: "Vapi.ai voice agents" },
  { value: "autocalls", label: "AutoCalls.ai", description: "AutoCalls.ai voice agents" },
  { value: "synthflow", label: "Synthflow", description: "Synthflow AI voice agents" },
];

// US Area Code to Timezone mapping
const AREA_CODE_TIMEZONES: Record<string, string> = {
  // Eastern Time
  "201": "America/New_York", "202": "America/New_York", "203": "America/New_York", "212": "America/New_York",
  "215": "America/New_York", "216": "America/New_York", "234": "America/New_York", "239": "America/New_York",
  "240": "America/New_York", "248": "America/New_York", "267": "America/New_York", "276": "America/New_York",
  "301": "America/New_York", "302": "America/New_York", "304": "America/New_York", "305": "America/New_York",
  "315": "America/New_York", "321": "America/New_York", "330": "America/New_York", "336": "America/New_York",
  "339": "America/New_York", "347": "America/New_York", "351": "America/New_York", "352": "America/New_York",
  "386": "America/New_York", "401": "America/New_York", "404": "America/New_York", "407": "America/New_York",
  "410": "America/New_York", "412": "America/New_York", "413": "America/New_York", "414": "America/New_York",
  "419": "America/New_York", "423": "America/New_York", "434": "America/New_York", "440": "America/New_York",
  "443": "America/New_York", "470": "America/New_York", "475": "America/New_York", "478": "America/New_York",
  "484": "America/New_York", "502": "America/New_York", "508": "America/New_York", "513": "America/New_York",
  "516": "America/New_York", "517": "America/New_York", "518": "America/New_York", "540": "America/New_York",
  "551": "America/New_York", "561": "America/New_York", "567": "America/New_York", "570": "America/New_York",
  "571": "America/New_York", "585": "America/New_York", "586": "America/New_York", "607": "America/New_York",
  "609": "America/New_York", "610": "America/New_York", "614": "America/New_York", "617": "America/New_York",
  "631": "America/New_York", "646": "America/New_York", "678": "America/New_York", "680": "America/New_York",
  "681": "America/New_York", "689": "America/New_York", "704": "America/New_York",
  "706": "America/New_York", "716": "America/New_York", "717": "America/New_York", "718": "America/New_York",
  "724": "America/New_York", "727": "America/New_York", "732": "America/New_York", "740": "America/New_York",
  "754": "America/New_York", "757": "America/New_York", "770": "America/New_York", "772": "America/New_York",
  "774": "America/New_York", "781": "America/New_York", "786": "America/New_York", "802": "America/New_York",
  "803": "America/New_York", "804": "America/New_York", "813": "America/New_York", "814": "America/New_York",
  "828": "America/New_York", "843": "America/New_York", "845": "America/New_York", "848": "America/New_York",
  "850": "America/New_York", "856": "America/New_York", "857": "America/New_York", "859": "America/New_York",
  "860": "America/New_York", "862": "America/New_York", "863": "America/New_York", "864": "America/New_York",
  "878": "America/New_York", "904": "America/New_York", "908": "America/New_York", "910": "America/New_York",
  "912": "America/New_York", "914": "America/New_York", "917": "America/New_York", "919": "America/New_York",
  "929": "America/New_York", "931": "America/New_York", "937": "America/New_York", "941": "America/New_York",
  "954": "America/New_York", "973": "America/New_York", "978": "America/New_York", "980": "America/New_York",
  // Central Time
  "205": "America/Chicago", "210": "America/Chicago", "214": "America/Chicago", "217": "America/Chicago",
  "218": "America/Chicago", "224": "America/Chicago", "225": "America/Chicago", "228": "America/Chicago",
  "251": "America/Chicago", "252": "America/Chicago", "254": "America/Chicago", "256": "America/Chicago",
  "262": "America/Chicago", "269": "America/Chicago", "270": "America/Chicago", "281": "America/Chicago",
  "309": "America/Chicago", "312": "America/Chicago", "314": "America/Chicago", "316": "America/Chicago",
  "317": "America/Chicago", "318": "America/Chicago", "319": "America/Chicago", "320": "America/Chicago",
  "331": "America/Chicago", "334": "America/Chicago", "337": "America/Chicago", "361": "America/Chicago",
  "402": "America/Chicago", "405": "America/Chicago", "409": "America/Chicago", "417": "America/Chicago",
  "430": "America/Chicago", "432": "America/Chicago", "469": "America/Chicago", "479": "America/Chicago",
  "501": "America/Chicago", "504": "America/Chicago", "507": "America/Chicago", "512": "America/Chicago",
  "515": "America/Chicago", "563": "America/Chicago", "573": "America/Chicago", "580": "America/Chicago",
  "601": "America/Chicago", "608": "America/Chicago", "612": "America/Chicago", "615": "America/Chicago",
  "618": "America/Chicago", "620": "America/Chicago", "630": "America/Chicago", "636": "America/Chicago",
  "641": "America/Chicago", "651": "America/Chicago", "660": "America/Chicago", "662": "America/Chicago",
  "682": "America/Chicago", "701": "America/Chicago", "708": "America/Chicago", "713": "America/Chicago",
  "715": "America/Chicago", "731": "America/Chicago", "737": "America/Chicago", "763": "America/Chicago",
  "769": "America/Chicago", "773": "America/Chicago", "779": "America/Chicago", "785": "America/Chicago",
  "806": "America/Chicago", "815": "America/Chicago", "816": "America/Chicago",
  "817": "America/Chicago", "830": "America/Chicago", "832": "America/Chicago", "847": "America/Chicago",
  "865": "America/Chicago", "870": "America/Chicago", "872": "America/Chicago", "901": "America/Chicago",
  "903": "America/Chicago", "913": "America/Chicago", "915": "America/Chicago", "918": "America/Chicago",
  "920": "America/Chicago", "936": "America/Chicago", "940": "America/Chicago", "952": "America/Chicago",
  "956": "America/Chicago", "972": "America/Chicago", "979": "America/Chicago", "985": "America/Chicago",
  // Mountain Time
  "303": "America/Denver", "307": "America/Denver", "385": "America/Denver", "406": "America/Denver",
  "435": "America/Denver", "505": "America/Denver", "520": "America/Denver", "575": "America/Denver",
  "602": "America/Denver", "623": "America/Denver", "719": "America/Denver", "720": "America/Denver",
  "801": "America/Denver", "928": "America/Denver", "970": "America/Denver",
  // Pacific Time
  "206": "America/Los_Angeles", "209": "America/Los_Angeles", "213": "America/Los_Angeles", "253": "America/Los_Angeles",
  "310": "America/Los_Angeles", "323": "America/Los_Angeles", "360": "America/Los_Angeles", "408": "America/Los_Angeles",
  "415": "America/Los_Angeles", "424": "America/Los_Angeles", "425": "America/Los_Angeles", "442": "America/Los_Angeles",
  "503": "America/Los_Angeles", "509": "America/Los_Angeles", "510": "America/Los_Angeles", "530": "America/Los_Angeles",
  "541": "America/Los_Angeles", "559": "America/Los_Angeles", "562": "America/Los_Angeles", "619": "America/Los_Angeles",
  "626": "America/Los_Angeles", "628": "America/Los_Angeles", "650": "America/Los_Angeles", "657": "America/Los_Angeles",
  "661": "America/Los_Angeles", "669": "America/Los_Angeles", "702": "America/Los_Angeles", "707": "America/Los_Angeles",
  "714": "America/Los_Angeles", "725": "America/Los_Angeles", "747": "America/Los_Angeles", "760": "America/Los_Angeles",
  "775": "America/Los_Angeles", "805": "America/Los_Angeles", "818": "America/Los_Angeles", "831": "America/Los_Angeles",
  "858": "America/Los_Angeles", "909": "America/Los_Angeles", "916": "America/Los_Angeles", "925": "America/Los_Angeles",
  "949": "America/Los_Angeles", "951": "America/Los_Angeles", "971": "America/Los_Angeles",
  // Alaska
  "907": "America/Anchorage",
  // Hawaii
  "808": "Pacific/Honolulu",
  // Arizona (no DST) - 480 is unique, others overlap with Denver but Arizona doesn't observe DST
  "480": "America/Phoenix",
};

function getTimezoneFromPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  let areaCode: string | null = null;

  if (digits.length === 10) {
    areaCode = digits.substring(0, 3);
  } else if (digits.length === 11 && digits.startsWith("1")) {
    areaCode = digits.substring(1, 4);
  }

  if (areaCode && AREA_CODE_TIMEZONES[areaCode]) {
    return AREA_CODE_TIMEZONES[areaCode];
  }

  return null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return rows;
}

interface ContactsUploadStepProps {
  campaignId: string;
  onUploadComplete?: (count: number) => void;
}

function ContactsUploadStep({ campaignId, onUploadComplete }: ContactsUploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<Record<string, string>[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    duplicates: number;
    total: number;
    uploadedContacts: Record<string, string>[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      alert("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const contacts = parseCSV(text);

      // Add timezone detection - check multiple phone column variations
      const contactsWithTimezone = contacts.map(contact => {
        const phone =
          contact.phone_number || contact.phone ||
          contact.Phone || contact.Phone_Number || contact.PhoneNumber ||
          contact.mobile || contact.Mobile || contact.cell || contact.Cell ||
          contact.telephone || contact.Telephone || contact.tel || contact.Tel ||
          "";
        const timezone = getTimezoneFromPhone(phone);
        return {
          ...contact,
          // Normalize phone field name for server
          phone_number: phone,
          timezone: contact.timezone || timezone || "",
        };
      });

      setParsedContacts(contactsWithTimezone);
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (parsedContacts.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Upload in chunks of 1000 contacts for better progress tracking
    const chunkSize = 1000;
    const chunks: Record<string, string>[][] = [];
    for (let i = 0; i < parsedContacts.length; i += chunkSize) {
      chunks.push(parsedContacts.slice(i, i + chunkSize));
    }

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalDuplicates = 0;
    let finalTotal = 0;

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const response = await fetch(`/api/admin/outbound-campaigns/${campaignId}/contacts/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: chunk }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const data = await response.json();
        totalSuccess += data.result.success;
        totalFailed += data.result.failed;
        totalDuplicates += data.result.duplicates;
        finalTotal = data.total_contacts;

        // Update progress
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        setUploadProgress(progress);
      }

      setUploadResult({
        success: totalSuccess,
        failed: totalFailed,
        duplicates: totalDuplicates,
        total: finalTotal,
        uploadedContacts: parsedContacts,
      });

      if (onUploadComplete) {
        onUploadComplete(totalSuccess);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedContacts([]);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Get detected columns
  const columns = parsedContacts.length > 0 ? Object.keys(parsedContacts[0]) : [];
  const phoneColumn = columns.find(c => {
    const lower = c.toLowerCase();
    return lower.includes("phone") || lower === "tel" || lower === "mobile" || lower === "cell" || lower === "telephone";
  });

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!file && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">Upload CSV File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop a CSV file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Required column: phone_number (or phone)<br />
              Optional: first_name, last_name, email, timezone
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* File Selected */}
      {file && !uploadResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div>
                    <CardTitle className="text-base">{file.name}</CardTitle>
                    <CardDescription>
                      {parsedContacts.length} contacts found
                      {phoneColumn && ` • Phone column: ${phoneColumn}`}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {parsedContacts.length > 0 && (
              <CardContent>
                <div className="text-sm text-muted-foreground mb-2">Preview (first 5 rows):</div>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.slice(0, 5).map((col) => (
                          <TableHead key={col} className="whitespace-nowrap text-xs">
                            {col}
                          </TableHead>
                        ))}
                        {columns.length > 5 && <TableHead className="text-xs">...</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedContacts.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {columns.slice(0, 5).map((col) => (
                            <TableCell key={col} className="text-xs py-2">
                              {row[col]?.substring(0, 20) || "-"}
                              {(row[col]?.length || 0) > 20 && "..."}
                            </TableCell>
                          ))}
                          {columns.length > 5 && <TableCell className="text-xs">...</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Timezone Detection Info */}
                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Timezone Detection:</strong> Timezones are auto-detected from US phone area codes.
                      {parsedContacts.filter(c => c.timezone).length > 0 && (
                        <span> {parsedContacts.filter(c => c.timezone).length} of {parsedContacts.length} contacts have detected timezones.</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Upload Progress */}
          {isUploading && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Uploading contacts...
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <div className="flex justify-between mt-2 text-sm text-blue-600 dark:text-blue-400">
                  <span>{uploadProgress}% complete</span>
                  <span>{Math.round((uploadProgress / 100) * parsedContacts.length).toLocaleString()} of {parsedContacts.length.toLocaleString()} contacts</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={clearFile} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isUploading || parsedContacts.length === 0}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="mr-2 h-4 w-4" />
              Upload {parsedContacts.length.toLocaleString()} Contacts
            </Button>
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div className="space-y-4">
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-700 dark:text-green-300">Upload Complete</h3>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {uploadResult.success.toLocaleString()} contacts added successfully
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.success.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Added</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-600">{uploadResult.duplicates.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Duplicates</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.failed.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Total contacts in campaign: <strong>{uploadResult.total.toLocaleString()}</strong>
                </p>
              </div>

              <Button variant="outline" onClick={clearFile} className="mt-4 w-full">
                <Plus className="mr-2 h-4 w-4" />
                Upload More Contacts
              </Button>
            </CardContent>
          </Card>

          {/* Uploaded Contacts with Timezones */}
          {uploadResult.uploadedContacts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Uploaded Contacts with Timezones
                </CardTitle>
                <CardDescription>
                  {uploadResult.uploadedContacts.filter(c => c.timezone).length} of {uploadResult.uploadedContacts.length} contacts have detected timezones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Timezone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadResult.uploadedContacts.slice(0, 100).map((contact, i) => {
                          const phone = contact.phone_number || contact.phone || contact.Phone || "";
                          const firstName = contact.first_name || contact.firstName || "";
                          const lastName = contact.last_name || contact.lastName || "";
                          const name = [firstName, lastName].filter(Boolean).join(" ");
                          const email = contact.email || contact.Email || "";
                          const timezone = contact.timezone || "";

                          return (
                            <TableRow key={i}>
                              <TableCell className="text-xs py-2 font-mono">{phone}</TableCell>
                              <TableCell className="text-xs py-2">{name || "-"}</TableCell>
                              <TableCell className="text-xs py-2">{email || "-"}</TableCell>
                              <TableCell className="text-xs py-2">
                                {timezone ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {getTimezoneFriendlyName(timezone)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {uploadResult.uploadedContacts.length > 100 && (
                    <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground text-center border-t">
                      Showing first 100 of {uploadResult.uploadedContacts.length.toLocaleString()} contacts
                    </div>
                  )}
                </div>

                {/* Timezone Summary */}
                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Timezone Summary:</strong>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(() => {
                          const tzCounts: Record<string, number> = {};
                          uploadResult.uploadedContacts.forEach(c => {
                            const tz = c.timezone || "Unknown";
                            tzCounts[tz] = (tzCounts[tz] || 0) + 1;
                          });
                          return Object.entries(tzCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map(([tz, count]) => (
                              <span key={tz} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                                {getTimezoneFriendlyName(tz)}: {count.toLocaleString()}
                              </span>
                            ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Skip Option */}
      {!uploadResult && (
        <p className="text-sm text-muted-foreground text-center">
          You can skip this step and upload contacts later from the campaign details page.
        </p>
      )}
    </div>
  );
}

const initialData: WizardData = {
  client_id: "",
  name: "",
  description: "",
  call_provider: "vapi",
  vapi_key_source: "system",
  vapi_api_key: "",
  vapi_assistant_id: "",
  vapi_phone_number_id: "",
  autocalls_key_source: "system",
  autocalls_api_key: "",
  autocalls_assistant_id: "",
  synthflow_key_source: "system",
  synthflow_api_key: "",
  synthflow_model_id: "",
  schedule_days: [1, 2, 3, 4, 5], // Mon-Fri
  schedule_start_time: "09:00",
  schedule_end_time: "17:00",
  schedule_timezone: "America/New_York",
  sms_templates: [],
  retry_enabled: true,
  retry_attempts: 2,
  retry_delay_minutes: 60,
  max_concurrent_calls: 5,
  calls_per_minute: 30,
  rate_per_minute: "0.15",
  billing_threshold: "100.00",
  is_test_mode: true,
  test_call_limit: 10,
};

function NewOutboundCampaignPageContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingVapi, setIsValidatingVapi] = useState(false);
  const [vapiValidationError, setVapiValidationError] = useState<string | null>(null);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    provider: string;
    assistant?: { id: string; name: string };
    error?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeCampaignId = searchParams.get("resume");
  const { toast } = useToast();

  // Load existing campaign data if resuming
  useEffect(() => {
    async function loadCampaignData() {
      if (!resumeCampaignId) return;

      setIsLoadingCampaign(true);
      try {
        const response = await fetch(`/api/admin/outbound-campaigns/${resumeCampaignId}`);
        if (response.ok) {
          const campaign = await response.json();

          // Set campaign ID so we update instead of create
          setCreatedCampaignId(campaign.id);

          // Populate form data from existing campaign
          setData((prev) => ({
            ...prev,
            client_id: campaign.client_id || "",
            name: campaign.name || "",
            description: campaign.description || "",
            call_provider: campaign.call_provider || "vapi",
            vapi_key_source: campaign.vapi_key_source || "system",
            vapi_assistant_id: campaign.vapi_assistant_id || "",
            vapi_phone_number_id: campaign.vapi_phone_number_id || "",
            autocalls_assistant_id: campaign.autocalls_assistant_id?.toString() || "",
            synthflow_model_id: campaign.synthflow_model_id || "",
            schedule_days: campaign.campaign_schedules?.[0]?.days_of_week || [1, 2, 3, 4, 5],
            schedule_start_time: campaign.campaign_schedules?.[0]?.start_time?.slice(0, 5) || "09:00",
            schedule_end_time: campaign.campaign_schedules?.[0]?.end_time?.slice(0, 5) || "17:00",
            schedule_timezone: campaign.campaign_schedules?.[0]?.timezone || "America/New_York",
            retry_enabled: campaign.retry_enabled ?? true,
            retry_attempts: campaign.retry_attempts || 2,
            retry_delay_minutes: campaign.retry_delay_minutes || 60,
            max_concurrent_calls: campaign.max_concurrent_calls || 5,
            calls_per_minute: campaign.calls_per_minute || 30,
            rate_per_minute: campaign.rate_per_minute || "0.15",
            billing_threshold: campaign.billing_threshold || "100.00",
            is_test_mode: campaign.is_test_mode ?? true,
            test_call_limit: campaign.test_call_limit || 10,
          }));

          // Start at step 3 (call provider) since basic info is already set
          setCurrentStep(3);

          toast({
            title: "Resuming Setup",
            description: `Continue setting up "${campaign.name}"`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to load campaign data",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load campaign data",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCampaign(false);
      }
    }

    loadCampaignData();
  }, [resumeCampaignId, toast]);

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch("/api/admin/clients");
        if (response.ok) {
          const clientsData = await response.json();
          setClients(clientsData.filter((c: Client & { is_active?: boolean }) => c.is_active !== false));
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load clients",
          variant: "destructive",
        });
      } finally {
        setIsLoadingClients(false);
      }
    }
    fetchClients();
  }, [toast]);

  const updateData = (field: keyof WizardData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (vapiValidationError) {
      setVapiValidationError(null);
    }
    // Clear verification result when provider settings change
    if (field.toString().includes("api_key") || field.toString().includes("assistant_id") || field.toString().includes("model_id") || field === "call_provider") {
      setVerificationResult(null);
    }
  };

  // Verify connection to the selected provider
  const verifyProviderConnection = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setVapiValidationError(null);

    try {
      let apiKey = "";
      let assistantId = "";
      let modelId = "";

      switch (data.call_provider) {
        case "vapi":
          if (data.vapi_key_source === "system") {
            // For system keys, we can't verify from client - show a different message
            setVerificationResult({
              success: true,
              provider: "vapi",
              assistant: {
                id: data.vapi_assistant_id,
                name: "System keys will be used (cannot verify from here)",
              },
            });
            toast({
              title: "System Keys Selected",
              description: "Assistant ID will be verified when the campaign is launched.",
            });
            setIsVerifying(false);
            return;
          }
          apiKey = data.vapi_api_key;
          assistantId = data.vapi_assistant_id;
          break;
        case "autocalls":
          if (data.autocalls_key_source === "system") {
            setVerificationResult({
              success: true,
              provider: "autocalls",
              assistant: {
                id: data.autocalls_assistant_id,
                name: "System keys will be used (cannot verify from here)",
              },
            });
            toast({
              title: "System Keys Selected",
              description: "Assistant ID will be verified when the campaign is launched.",
            });
            setIsVerifying(false);
            return;
          }
          apiKey = data.autocalls_api_key;
          assistantId = data.autocalls_assistant_id;
          break;
        case "synthflow":
          if (data.synthflow_key_source === "system") {
            setVerificationResult({
              success: true,
              provider: "synthflow",
              assistant: {
                id: data.synthflow_model_id,
                name: "System keys will be used (cannot verify from here)",
              },
            });
            toast({
              title: "System Keys Selected",
              description: "Agent ID will be verified when the campaign is launched.",
            });
            setIsVerifying(false);
            return;
          }
          apiKey = data.synthflow_api_key;
          modelId = data.synthflow_model_id;
          break;
      }

      const response = await fetch("/api/admin/outbound-campaigns/verify-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: data.call_provider,
          api_key: apiKey,
          assistant_id: assistantId || undefined,
          model_id: modelId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setVerificationResult({
          success: false,
          provider: data.call_provider,
          error: result.error || "Verification failed",
        });
        setVapiValidationError(result.error || "Verification failed");
        toast({
          title: "Verification Failed",
          description: result.error || "Could not verify provider connection",
          variant: "destructive",
        });
      } else {
        setVerificationResult(result);
        toast({
          title: "Connection Verified!",
          description: result.assistant?.name
            ? `Successfully connected to "${result.assistant.name}"`
            : "API key is valid",
        });
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVapiValidationError("Failed to verify connection");
      setVerificationResult({
        success: false,
        provider: data.call_provider,
        error: "Failed to verify connection",
      });
      toast({
        title: "Error",
        description: "Failed to verify provider connection",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Validate provider credentials
  const validateProviderCredentials = async () => {
    setIsValidatingVapi(true);
    setVapiValidationError(null);

    try {
      // Validate based on selected provider
      switch (data.call_provider) {
        case "vapi":
          // If using system keys, only validate assistant ID format
          if (data.vapi_key_source === "system") {
            if (!data.vapi_assistant_id.trim()) {
              setVapiValidationError("Assistant ID is required");
              return false;
            }
            return true;
          }
          // Validate client Vapi credentials
          if (!data.vapi_api_key || !data.vapi_assistant_id) {
            setVapiValidationError("API Key and Assistant ID are required");
            return false;
          }
          // Call Vapi API to validate
          const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${data.vapi_assistant_id}`, {
            headers: { Authorization: `Bearer ${data.vapi_api_key}` },
          });
          if (!vapiResponse.ok) {
            if (vapiResponse.status === 401) {
              setVapiValidationError("Invalid API Key");
              return false;
            }
            if (vapiResponse.status === 404) {
              setVapiValidationError("Assistant not found");
              return false;
            }
            setVapiValidationError("Failed to validate Vapi credentials");
            return false;
          }
          break;

        case "autocalls":
          // If using system keys, only validate assistant ID
          if (data.autocalls_key_source === "system") {
            if (!data.autocalls_assistant_id.trim()) {
              setVapiValidationError("Assistant ID is required");
              return false;
            }
          } else {
            if (!data.autocalls_api_key || !data.autocalls_assistant_id) {
              setVapiValidationError("API Key and Assistant ID are required for AutoCalls");
              return false;
            }
          }
          // Basic format validation (AutoCalls uses integer IDs)
          if (isNaN(parseInt(data.autocalls_assistant_id))) {
            setVapiValidationError("AutoCalls Assistant ID must be a number");
            return false;
          }
          break;

        case "synthflow":
          // If using system keys, only validate agent ID
          if (data.synthflow_key_source === "system") {
            if (!data.synthflow_model_id.trim()) {
              setVapiValidationError("Agent ID is required");
              return false;
            }
          } else {
            if (!data.synthflow_api_key || !data.synthflow_model_id) {
              setVapiValidationError("API Key and Agent ID are required for Synthflow");
              return false;
            }
          }
          break;
      }

      toast({
        title: "Credentials validated",
        description: "Your provider credentials look valid.",
      });
      return true;
    } catch (error) {
      console.error("Provider validation error:", error);
      setVapiValidationError("Failed to validate credentials.");
      return false;
    } finally {
      setIsValidatingVapi(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!data.client_id;
      case 2:
        return !!data.name;
      case 3:
        // Validate based on selected provider
        switch (data.call_provider) {
          case "vapi":
            if (data.vapi_key_source === "system") {
              return !!data.vapi_assistant_id.trim();
            }
            return !!data.vapi_api_key.trim() && !!data.vapi_assistant_id.trim();
          case "autocalls":
            if (data.autocalls_key_source === "system") {
              return !!data.autocalls_assistant_id.trim();
            }
            return !!data.autocalls_api_key.trim() && !!data.autocalls_assistant_id.trim();
          case "synthflow":
            if (data.synthflow_key_source === "system") {
              return !!data.synthflow_model_id.trim();
            }
            return !!data.synthflow_api_key.trim() && !!data.synthflow_model_id.trim();
          default:
            return false;
        }
      case 4:
        return data.schedule_days.length > 0 && !!data.schedule_start_time && !!data.schedule_end_time;
      case 8:
        return parseFloat(data.rate_per_minute) > 0;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate provider credentials on step 3
    if (currentStep === 3) {
      const isValid = await validateProviderCredentials();
      if (!isValid) return;
    }

    // Create campaign after step 2
    if (currentStep === 2 && !createdCampaignId) {
      setIsSubmitting(true);
      try {
        const response = await fetch("/api/admin/outbound-campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: data.client_id,
            name: data.name,
            description: data.description || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create campaign");
        }

        const campaign = await response.json();
        setCreatedCampaignId(campaign.id);
        toast({
          title: "Campaign Created",
          description: "Draft campaign saved. Continue configuring...",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create campaign",
          variant: "destructive",
        });
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSaveDraft = async () => {
    if (!createdCampaignId) return;
    setIsSubmitting(true);
    try {
      await saveCampaignData();
      toast({
        title: "Draft Saved",
        description: "Campaign configuration saved successfully",
      });
      router.push(`/admin/outbound/${createdCampaignId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveCampaignData = async () => {
    if (!createdCampaignId) return;

    // Build provider-specific config based on selected provider
    const providerConfig: Record<string, unknown> = {
      call_provider: data.call_provider,
    };

    switch (data.call_provider) {
      case "vapi":
        providerConfig.vapi_key_source = data.vapi_key_source;
        providerConfig.vapi_api_key = data.vapi_key_source === "client" ? data.vapi_api_key : null;
        providerConfig.vapi_assistant_id = data.vapi_assistant_id;
        providerConfig.vapi_phone_number_id = data.vapi_phone_number_id || null;
        break;
      case "autocalls":
        providerConfig.provider_api_key = data.autocalls_api_key;
        providerConfig.autocalls_assistant_id = parseInt(data.autocalls_assistant_id);
        break;
      case "synthflow":
        providerConfig.provider_api_key = data.synthflow_api_key;
        providerConfig.synthflow_model_id = data.synthflow_model_id;
        break;
    }

    const response = await fetch(`/api/admin/outbound-campaigns/${createdCampaignId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        ...providerConfig,
        retry_enabled: data.retry_enabled,
        retry_attempts: data.retry_attempts,
        retry_delay_minutes: data.retry_delay_minutes,
        max_concurrent_calls: data.max_concurrent_calls,
        calls_per_minute: data.calls_per_minute,
        rate_per_minute: parseFloat(data.rate_per_minute),
        billing_threshold: parseFloat(data.billing_threshold),
        is_test_mode: data.is_test_mode,
        test_call_limit: data.test_call_limit,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to save campaign");
    }
  };

  const handleCreateCampaign = async () => {
    setIsSubmitting(true);
    try {
      // Save the campaign (creates if not exists, updates if exists)
      await saveCampaignData();

      // Get the campaign ID (either already created or just created)
      const campaignId = createdCampaignId;

      if (!campaignId) {
        throw new Error("Campaign was not created properly");
      }

      toast({
        title: "Campaign Created!",
        description: "Your campaign has been saved as a draft. You can start it from the campaign details page.",
      });

      // Redirect to the campaign details page
      router.push(`/admin/outbound/${campaignId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add SMS template
  const addSmsTemplate = () => {
    updateData("sms_templates", [
      ...data.sms_templates,
      { name: "", trigger_type: "call_completed", template_body: "", link_url: "" },
    ]);
  };

  const removeSmsTemplate = (index: number) => {
    updateData(
      "sms_templates",
      data.sms_templates.filter((_, i) => i !== index)
    );
  };

  const updateSmsTemplate = (index: number, field: string, value: string) => {
    const updated = [...data.sms_templates];
    updated[index] = { ...updated[index], [field]: value };
    updateData("sms_templates", updated);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Select Client</h2>
              <p className="text-muted-foreground">
                Choose the client this outbound campaign is for.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              {isLoadingClients ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading clients...</span>
                </div>
              ) : (
                <Select
                  value={data.client_id}
                  onValueChange={(value) => updateData("client_id", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                        {client.company_name && ` (${client.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Campaign Details</h2>
              <p className="text-muted-foreground">
                Provide basic information about your campaign.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => updateData("name", e.target.value)}
                  placeholder="e.g., Q1 Sales Outreach"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={data.description}
                  onChange={(e) => updateData("description", e.target.value)}
                  placeholder="Brief description of this campaign..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Call Provider</h2>
              <p className="text-muted-foreground">
                Choose and configure the AI voice provider that will handle outbound calls.
              </p>
            </div>

            <div className="space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Call Provider *</Label>
                <Select
                  value={data.call_provider}
                  onValueChange={(value: "vapi" | "autocalls" | "synthflow") => updateData("call_provider", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        <div className="flex flex-col">
                          <span>{provider.label}</span>
                          <span className="text-xs text-muted-foreground">{provider.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vapi Configuration */}
              {data.call_provider === "vapi" && (
                <>
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={data.vapi_key_source}
                      onValueChange={(value: "system" | "client") => updateData("vapi_key_source", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Keys (Bill to Client)</SelectItem>
                        <SelectItem value="client">Client&apos;s Own Keys</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {data.vapi_key_source === "client" && (
                    <div className="space-y-2">
                      <Label htmlFor="vapi_api_key">Vapi API Key *</Label>
                      <div className="relative">
                        <Input
                          id="vapi_api_key"
                          type={showApiKey ? "text" : "password"}
                          value={data.vapi_api_key}
                          onChange={(e) => updateData("vapi_api_key", e.target.value)}
                          placeholder="vapi_xxxxxxxx..."
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="vapi_assistant_id">Assistant ID *</Label>
                    <Input
                      id="vapi_assistant_id"
                      value={data.vapi_assistant_id}
                      onChange={(e) => updateData("vapi_assistant_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vapi_phone_number_id">Phone Number ID</Label>
                    <Input
                      id="vapi_phone_number_id"
                      value={data.vapi_phone_number_id}
                      onChange={(e) => updateData("vapi_phone_number_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Optional</p>
                  </div>
                </>
              )}

              {/* AutoCalls Configuration */}
              {data.call_provider === "autocalls" && (
                <>
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={data.autocalls_key_source}
                      onValueChange={(value: "system" | "client") => updateData("autocalls_key_source", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Keys (Bill to Client)</SelectItem>
                        <SelectItem value="client">Client&apos;s Own Keys</SelectItem>
                      </SelectContent>
                    </Select>
                    {data.autocalls_key_source === "system" && (
                      <p className="text-xs text-muted-foreground">
                        Platform-level API keys from Settings will be used. Usage will be billed to the client.
                      </p>
                    )}
                  </div>

                  {data.autocalls_key_source === "client" && (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                          <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">AutoCalls.ai Credentials</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Get your API key and Assistant ID from{" "}
                              <a href="https://app.autocalls.ai" target="_blank" rel="noopener noreferrer" className="underline">
                                app.autocalls.ai <ExternalLink className="inline h-3 w-3" />
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="autocalls_api_key">API Key *</Label>
                        <div className="relative">
                          <Input
                            id="autocalls_api_key"
                            type={showApiKey ? "text" : "password"}
                            value={data.autocalls_api_key}
                            onChange={(e) => updateData("autocalls_api_key", e.target.value)}
                            placeholder="Your AutoCalls API key"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="autocalls_assistant_id">Assistant ID *</Label>
                    <Input
                      id="autocalls_assistant_id"
                      value={data.autocalls_assistant_id}
                      onChange={(e) => updateData("autocalls_assistant_id", e.target.value)}
                      placeholder="123456"
                    />
                    <p className="text-xs text-muted-foreground">Numeric ID from your AutoCalls dashboard</p>
                  </div>
                </>
              )}

              {/* Synthflow Configuration */}
              {data.call_provider === "synthflow" && (
                <>
                  <div className="space-y-2">
                    <Label>API Key Source</Label>
                    <Select
                      value={data.synthflow_key_source}
                      onValueChange={(value: "system" | "client") => updateData("synthflow_key_source", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System Keys (Bill to Client)</SelectItem>
                        <SelectItem value="client">Client&apos;s Own Keys</SelectItem>
                      </SelectContent>
                    </Select>
                    {data.synthflow_key_source === "system" && (
                      <p className="text-xs text-muted-foreground">
                        Platform-level API keys from Settings will be used. Usage will be billed to the client.
                      </p>
                    )}
                  </div>

                  {data.synthflow_key_source === "client" && (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex gap-3">
                          <Key className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">Synthflow Credentials</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Get your API key and Agent ID from{" "}
                              <a href="https://app.synthflow.ai" target="_blank" rel="noopener noreferrer" className="underline">
                                app.synthflow.ai <ExternalLink className="inline h-3 w-3" />
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="synthflow_api_key">API Key *</Label>
                        <div className="relative">
                          <Input
                            id="synthflow_api_key"
                            type={showApiKey ? "text" : "password"}
                            value={data.synthflow_api_key}
                            onChange={(e) => updateData("synthflow_api_key", e.target.value)}
                            placeholder="Your Synthflow API key"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="synthflow_model_id">Agent ID (model_id) *</Label>
                    <Input
                      id="synthflow_model_id"
                      value={data.synthflow_model_id}
                      onChange={(e) => updateData("synthflow_model_id", e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">Found on your agent&apos;s page in Synthflow</p>
                  </div>
                </>
              )}

              {/* Verification Result */}
              {verificationResult && (
                <div className={`rounded-lg p-4 ${
                  verificationResult.success
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}>
                  <div className="flex gap-3">
                    {verificationResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      {verificationResult.success ? (
                        <>
                          <p className="font-medium text-green-700 dark:text-green-300">
                            Connection Verified!
                          </p>
                          {verificationResult.assistant && (
                            <p className="text-sm text-green-600 dark:text-green-400">
                              Assistant: {verificationResult.assistant.name}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {verificationResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Validation error (only show if no verification result) */}
              {vapiValidationError && !verificationResult && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{vapiValidationError}</p>
                  </div>
                </div>
              )}

              {/* Verify Connection Button */}
              <Button
                type="button"
                variant="outline"
                onClick={verifyProviderConnection}
                disabled={isVerifying || !canProceed()}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Connection...
                  </>
                ) : verificationResult?.success ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Verified - Click to Re-verify
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Verify Connection
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Call Schedule</h2>
              <p className="text-muted-foreground">
                Set when calls should be made based on contact timezones.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={data.schedule_days.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (data.schedule_days.includes(day.value)) {
                          updateData(
                            "schedule_days",
                            data.schedule_days.filter((d) => d !== day.value)
                          );
                        } else {
                          updateData("schedule_days", [...data.schedule_days, day.value]);
                        }
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={data.schedule_start_time}
                    onChange={(e) => updateData("schedule_start_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={data.schedule_end_time}
                    onChange={(e) => updateData("schedule_end_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={data.schedule_timezone}
                    onValueChange={(value) => updateData("schedule_timezone", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Calls will be made during these hours in the contact&apos;s local timezone.
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">SMS Follow-up Templates</h2>
              <p className="text-muted-foreground">
                Configure automated SMS messages to send after calls.
              </p>
            </div>
            <div className="space-y-4">
              {data.sms_templates.map((template, index) => (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="grid gap-4 md:grid-cols-2 flex-1">
                        <div className="space-y-2">
                          <Label>Template Name</Label>
                          <Input
                            value={template.name}
                            onChange={(e) => updateSmsTemplate(index, "name", e.target.value)}
                            placeholder="e.g., Thank You SMS"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Trigger</Label>
                          <Select
                            value={template.trigger_type}
                            onValueChange={(value) => updateSmsTemplate(index, "trigger_type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SMS_TRIGGER_TYPES.map((trigger) => (
                                <SelectItem key={trigger.value} value={trigger.value}>
                                  {trigger.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSmsTemplate(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Message Body</Label>
                      <Textarea
                        value={template.template_body}
                        onChange={(e) => updateSmsTemplate(index, "template_body", e.target.value)}
                        placeholder="Hi {{contact_name}}, thank you for speaking with us..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Link URL (optional)</Label>
                      <Input
                        value={template.link_url}
                        onChange={(e) => updateSmsTemplate(index, "link_url", e.target.value)}
                        placeholder="https://example.com/schedule"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addSmsTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                Add SMS Template
              </Button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Contact List</h2>
              <p className="text-muted-foreground">
                Upload your contact list for this campaign. Timezones will be auto-detected from phone area codes.
              </p>
            </div>
            {createdCampaignId ? (
              <ContactsUploadStep
                campaignId={createdCampaignId}
                onUploadComplete={(count) => {
                  toast({
                    title: "Contacts Uploaded",
                    description: `Successfully uploaded ${count} contacts`,
                  });
                }}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>Complete the previous steps to enable contact upload.</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Retry Settings</h2>
              <p className="text-muted-foreground">
                Configure how the system handles unanswered calls.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Retry</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically retry unanswered calls
                  </p>
                </div>
                <Switch
                  checked={data.retry_enabled}
                  onCheckedChange={(checked) => updateData("retry_enabled", checked)}
                />
              </div>
              {data.retry_enabled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input
                      type="number"
                      value={data.retry_attempts}
                      onChange={(e) => updateData("retry_attempts", parseInt(e.target.value) || 0)}
                      min={1}
                      max={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delay Between Retries (minutes)</Label>
                    <Input
                      type="number"
                      value={data.retry_delay_minutes}
                      onChange={(e) => updateData("retry_delay_minutes", parseInt(e.target.value) || 0)}
                      min={15}
                      max={1440}
                    />
                  </div>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Concurrent Calls</Label>
                  <Input
                    type="number"
                    value={data.max_concurrent_calls}
                    onChange={(e) => updateData("max_concurrent_calls", parseInt(e.target.value) || 1)}
                    min={1}
                    max={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of simultaneous calls
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Calls Per Minute</Label>
                  <Input
                    type="number"
                    value={data.calls_per_minute}
                    onChange={(e) => updateData("calls_per_minute", parseInt(e.target.value) || 1)}
                    min={1}
                    max={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Rate limit for initiating new calls
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Billing Settings</h2>
              <p className="text-muted-foreground">
                Configure the billing rate for this campaign.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rate Per Minute ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.rate_per_minute}
                    onChange={(e) => updateData("rate_per_minute", e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Threshold ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.billing_threshold}
                    onChange={(e) => updateData("billing_threshold", e.target.value)}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Campaign pauses when this threshold is reached without payment
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Review & Create</h2>
              <p className="text-muted-foreground">
                Review your campaign settings. After creating, you can start the campaign from the campaign details page.
              </p>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Campaign Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{data.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Client</Label>
                      <p className="font-medium">
                        {clients.find((c) => c.id === data.client_id)?.name || "Not selected"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Call Provider</Label>
                      <p className="font-medium">
                        {data.call_provider === "vapi" ? "Vapi" : data.call_provider === "autocalls" ? "AutoCalls.ai" : "Synthflow"}
                        {" "}
                        ({data.call_provider === "vapi"
                          ? (data.vapi_key_source === "system" ? "System Keys" : "Client Keys")
                          : data.call_provider === "autocalls"
                          ? (data.autocalls_key_source === "system" ? "System Keys" : "Client Keys")
                          : (data.synthflow_key_source === "system" ? "System Keys" : "Client Keys")
                        })
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Schedule</Label>
                      <p className="font-medium">
                        {data.schedule_days.map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label.slice(0,3)).join(", ")}
                        {" "}{data.schedule_start_time} - {data.schedule_end_time}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Rate</Label>
                      <p className="font-medium">${data.rate_per_minute}/min</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Limits</Label>
                      <p className="font-medium">
                        {data.max_concurrent_calls} concurrent, {data.calls_per_minute}/min
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Mode Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Test Mode Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Test Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, campaign will pause after the test call limit is reached
                      </p>
                    </div>
                    <Switch
                      checked={data.is_test_mode}
                      onCheckedChange={(checked) => updateData("is_test_mode", checked)}
                    />
                  </div>
                  {data.is_test_mode && (
                    <div className="space-y-2">
                      <Label>Test Call Limit</Label>
                      <Input
                        type="number"
                        value={data.test_call_limit}
                        onChange={(e) => updateData("test_call_limit", parseInt(e.target.value) || 1)}
                        min={1}
                        max={100}
                      />
                      <p className="text-xs text-muted-foreground">
                        Campaign will automatically pause after this many calls. You can then review results and decide to continue.
                      </p>
                    </div>
                  )}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Recommended:</strong> Enable test mode for new campaigns. Make 5-10 test calls to verify your AI agent
                        is working correctly before launching at full scale.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* What Happens Next */}
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    What Happens After Creating
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li><strong>Campaign Created as Draft</strong> - Your campaign will be saved but not started yet</li>
                    <li><strong>Webhook URL Generated</strong> - A unique webhook URL will be created for receiving call data</li>
                    <li><strong>Upload Contacts</strong> - Add your contact list from the campaign details page</li>
                    <li><strong>Start Campaign</strong> - When ready, start the campaign from the campaign card or details page</li>
                  </ol>
                  <div className="pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>Note:</strong> Campaigns are created in &quot;draft&quot; status. You control when to start calling from the campaign management page.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Show loading state while resuming
  if (isLoadingCampaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading campaign data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/outbound">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {resumeCampaignId ? "Continue Campaign Setup" : "New Outbound Campaign"}
          </h1>
          <p className="text-muted-foreground">
            {resumeCampaignId
              ? `Resume setting up "${data.name}"`
              : "Create an AI-powered outbound calling campaign"}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {currentStep} of {STEPS.length}</span>
          <span>{STEPS[currentStep - 1].title}</span>
        </div>
        <Progress value={(currentStep / STEPS.length) * 100} />
      </div>

      {/* Step Indicators */}
      <div className="hidden md:flex justify-between">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`flex flex-col items-center gap-1 ${
              step.id === currentStep
                ? "text-primary"
                : step.id < currentStep
                ? "text-green-600"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.id === currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.id < currentStep
                  ? "bg-green-600 text-white"
                  : "bg-muted"
              }`}
            >
              {step.id < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <step.icon className="h-4 w-4" />
              )}
            </div>
            <span className="text-xs">{step.title}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">{renderStep()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {createdCampaignId && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSubmitting}>
              Save Draft
            </Button>
          )}
          {currentStep === STEPS.length ? (
            <Button onClick={handleCreateCampaign} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={isSubmitting || isValidatingVapi || !canProceed()}>
              {(isSubmitting || isValidatingVapi) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isValidatingVapi ? "Validating..." : "Next"}
              {!isValidatingVapi && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewOutboundCampaignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <NewOutboundCampaignPageContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Phone,
  Edit,
  Building,
  Calendar,
  MapPin,
  Globe,
  Clock,
  User,
  Activity,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  company: string | null;
  job_title: string | null;
  website: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string | null;
  status: string;
  pipeline_stage: string;
  lead_source: string | null;
  lead_score: number;
  tags: string[];
  notes: string | null;
  do_not_contact: boolean;
  do_not_email: boolean;
  do_not_call: boolean;
  do_not_sms: boolean;
  created_at: string;
  last_contacted_at: string | null;
  total_calls: number;
  total_emails_sent: number;
  total_sms_sent: number;
  assigned_admin?: {
    id: string;
    name: string;
    email: string;
  } | null;
  activities?: ActivityRecord[];
  calls?: CallRecord[];
  emails?: EmailRecord[];
  sms_messages?: SmsRecord[];
}

interface ActivityRecord {
  id: string;
  activity_type: string;
  subject: string;
  body: string | null;
  performed_by_name: string;
  created_at: string;
}

interface CallRecord {
  id: string;
  caller_number: string;
  call_type: string;
  duration: number | null;
  sentiment: string | null;
  created_at: string;
}

interface EmailRecord {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
}

interface SmsRecord {
  id: string;
  message: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "qualified", label: "Qualified" },
  { value: "customer", label: "Customer" },
  { value: "churned", label: "Churned" },
];

const PIPELINE_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContact();
  }, [id]);

  const fetchContact = async () => {
    try {
      const response = await fetch(`/api/admin/crm/contacts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setContact(data);
      } else if (response.status === 404) {
        toast({
          title: "Contact not found",
          variant: "destructive",
        });
        router.push("/admin/crm");
      }
    } catch (error) {
      console.error("Error fetching contact:", error);
      toast({
        title: "Error",
        description: "Failed to load contact",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateContact = async (field: string, value: string) => {
    if (!contact) return;
    try {
      const response = await fetch(`/api/admin/crm/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (response.ok) {
        const updated = await response.json();
        setContact({ ...contact, ...updated });
        toast({ title: "Contact updated" });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !contact) return;
    setSavingNote(true);
    try {
      const response = await fetch("/api/admin/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: id,
          client_id: contact.client_id,
          activity_type: "note",
          subject: "Note added",
          body: newNote,
        }),
      });
      if (response.ok) {
        setNewNote("");
        fetchContact(); // Refresh to get new activity
        toast({ title: "Note added" });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading contact...
        </div>
      </div>
    );
  }

  if (!contact) {
    return null;
  }

  const contactName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown";
  const address = [
    contact.address_line1,
    contact.city,
    contact.state,
    contact.postal_code,
    contact.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/crm">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{contactName}</h1>
            <p className="text-muted-foreground">
              {contact.company || "No company"} {contact.job_title ? `• ${contact.job_title}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {contact.email && !contact.do_not_email && (
            <Link href={`/admin/crm/${id}/email`}>
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </Link>
          )}
          {contact.phone && !contact.do_not_sms && (
            <Link href={`/admin/crm/${id}/sms`}>
              <Button variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                SMS
              </Button>
            </Link>
          )}
          {contact.phone && !contact.do_not_call && (
            <a href={`tel:${contact.phone}`}>
              <Button variant="outline">
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </a>
          )}
          <Link href={`/admin/crm/${id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Opt-out warnings */}
      {(contact.do_not_contact || contact.do_not_email || contact.do_not_call || contact.do_not_sms) && (
        <div className="flex gap-2 flex-wrap">
          {contact.do_not_contact && (
            <Badge variant="destructive">Do Not Contact</Badge>
          )}
          {contact.do_not_email && (
            <Badge variant="outline" className="border-orange-500 text-orange-600">
              No Email
            </Badge>
          )}
          {contact.do_not_call && (
            <Badge variant="outline" className="border-orange-500 text-orange-600">
              No Calls
            </Badge>
          )}
          {contact.do_not_sms && (
            <Badge variant="outline" className="border-orange-500 text-orange-600">
              No SMS
            </Badge>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Status Cards */}
          <div className="grid gap-4 grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={contact.status}
                  onValueChange={(value) => updateContact("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pipeline Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={contact.pipeline_stage}
                  onValueChange={(value) => updateContact("pipeline_stage", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Activity Tabs */}
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">
                <Activity className="mr-2 h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="emails">
                <Mail className="mr-2 h-4 w-4" />
                Emails ({contact.emails?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="sms">
                <MessageSquare className="mr-2 h-4 w-4" />
                SMS ({contact.sms_messages?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="calls">
                <Phone className="mr-2 h-4 w-4" />
                Calls ({contact.calls?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="space-y-4">
              {/* Add Note */}
              <Card>
                <CardContent className="pt-4">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={addNote}
                      disabled={!newNote.trim() || savingNote}
                    >
                      {savingNote ? "Saving..." : "Add Note"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <div className="space-y-4">
                {contact.activities && contact.activities.length > 0 ? (
                  contact.activities.map((activity) => (
                    <Card key={activity.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{activity.activity_type}</Badge>
                              <span className="font-medium">{activity.subject}</span>
                            </div>
                            {activity.body && (
                              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                                {activity.body}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div>{activity.performed_by_name}</div>
                            <div>{format(new Date(activity.created_at), "MMM d, h:mm a")}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No activity recorded yet
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="emails">
              <div className="space-y-4">
                {contact.emails && contact.emails.length > 0 ? (
                  contact.emails.map((email) => (
                    <Card key={email.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{email.subject}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(email.created_at), "MMM d, yyyy h:mm a")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={email.status === "sent" ? "default" : "secondary"}
                            >
                              {email.status}
                            </Badge>
                            {email.opened_at && (
                              <Badge variant="outline" className="text-green-600">
                                Opened
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No emails sent yet
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sms">
              <div className="space-y-4">
                {contact.sms_messages && contact.sms_messages.length > 0 ? (
                  contact.sms_messages.map((sms) => (
                    <Card key={sms.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm">{sms.message}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(sms.created_at), "MMM d, yyyy h:mm a")}
                            </div>
                          </div>
                          <Badge
                            variant={sms.status === "sent" ? "default" : "secondary"}
                          >
                            {sms.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No SMS messages sent yet
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="calls">
              <div className="space-y-4">
                {contact.calls && contact.calls.length > 0 ? (
                  contact.calls.map((call) => (
                    <Card key={call.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{call.call_type} Call</div>
                            <div className="text-sm text-muted-foreground">
                              {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "No duration"}
                              {" • "}
                              {format(new Date(call.created_at), "MMM d, yyyy h:mm a")}
                            </div>
                          </div>
                          {call.sentiment && (
                            <Badge variant="outline">{call.sentiment}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No calls recorded yet
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-sm hover:underline"
                  >
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.company}</span>
                </div>
              )}
              {contact.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                  >
                    {contact.website}
                  </a>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">{address}</span>
                </div>
              )}
              {contact.timezone && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.timezone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Lead Score</span>
                <span className="font-medium">{contact.lead_score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <span className="font-medium">{contact.lead_source || "-"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Calls</span>
                <span className="font-medium">{contact.total_calls}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Emails Sent</span>
                <span className="font-medium">{contact.total_emails_sent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">SMS Sent</span>
                <span className="font-medium">{contact.total_sms_sent}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assigned To */}
          {contact.assigned_admin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assigned To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{contact.assigned_admin.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {contact.assigned_admin.email}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="font-medium">
                    {format(new Date(contact.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              </div>
              {contact.last_contacted_at && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Last Contact</div>
                    <div className="font-medium">
                      {format(new Date(contact.last_contacted_at), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Mail,
  Phone,
  HelpCircle,
  FileText,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const categoryOptions = [
  { value: "general", label: "General Question" },
  { value: "billing", label: "Billing & Payments" },
  { value: "technical", label: "Technical Issue" },
  { value: "campaign", label: "Campaign Help" },
  { value: "account", label: "Account Management" },
];

const priorityOptions = [
  { value: "low", label: "Low", description: "General questions" },
  { value: "normal", label: "Normal", description: "Standard issues" },
  { value: "high", label: "High", description: "Affecting work" },
  { value: "urgent", label: "Urgent", description: "Critical issue" },
];

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "general",
    priority: "normal",
  });

  const { toast } = useToast();
  const supabase = createClient();

  const fetchTickets = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("email", user.email)
          .single();

        if (client) {
          const { data: ticketData, error } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("client_id", client.id)
            .order("created_at", { ascending: false });

          if (error) throw error;
          setTickets(ticketData || []);
        }
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [supabase]);

  const handleSubmitTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/client/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      });

      if (!response.ok) {
        throw new Error("Failed to submit ticket");
      }

      toast({
        title: "Ticket Submitted",
        description: "We'll get back to you as soon as possible",
      });

      setDialogOpen(false);
      setNewTicket({ subject: "", description: "", category: "general", priority: "normal" });
      fetchTickets();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />Open</Badge>;
      case "in_progress":
        return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />In Progress</Badge>;
      case "waiting_on_client":
        return <Badge variant="outline" className="gap-1"><HelpCircle className="h-3 w-3" />Awaiting Reply</Badge>;
      case "resolved":
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Resolved</Badge>;
      case "closed":
        return <Badge variant="default">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge variant="warning">High</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">
            Get help and contact our support team
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit a Support Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue and we&apos;ll get back to you as soon as possible
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((pri) => (
                        <SelectItem key={pri.value} value={pri.value}>
                          {pri.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Please provide as much detail as possible..."
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitTicket} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Contact */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">Email Support</h3>
                <p className="text-sm text-muted-foreground">support@example.com</p>
                <p className="text-xs text-muted-foreground mt-1">Response within 24 hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium">Phone Support</h3>
                <p className="text-sm text-muted-foreground">+1 (800) 123-4567</p>
                <p className="text-xs text-muted-foreground mt-1">Mon-Fri, 9am-5pm ET</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">Documentation</h3>
                <p className="text-sm text-muted-foreground">Help articles & guides</p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <a href="/dashboard/help">View Help Center <ArrowRight className="ml-1 h-3 w-3" /></a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets */}
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">
            Open Tickets ({tickets.filter(t => !["resolved", "closed"].includes(t.status)).length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({tickets.filter(t => ["resolved", "closed"].includes(t.status)).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.filter(t => !["resolved", "closed"].includes(t.status)).length > 0 ? (
            <div className="space-y-3">
              {tickets
                .filter(t => !["resolved", "closed"].includes(t.status))
                .map((ticket) => (
                  <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <h3 className="font-medium truncate">{ticket.subject}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {ticket.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          View <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No open tickets</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You don&apos;t have any open support tickets
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create a Ticket
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          {tickets.filter(t => ["resolved", "closed"].includes(t.status)).length > 0 ? (
            <div className="space-y-3">
              {tickets
                .filter(t => ["resolved", "closed"].includes(t.status))
                .map((ticket) => (
                  <Card key={ticket.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(ticket.status)}
                          </div>
                          <h3 className="font-medium truncate">{ticket.subject}</h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            Resolved {ticket.resolved_at
                              ? formatDistanceToNow(new Date(ticket.resolved_at), { addSuffix: true })
                              : formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          View <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No resolved tickets</h3>
                <p className="text-sm text-muted-foreground">
                  Resolved tickets will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface PhoneNumber {
  id: string;
  campaign_id: string | null;
  client_id: string;
  phone_number: string;
  friendly_name: string | null;
  provider: string;
  twilio_sid: string | null;
  vapi_phone_id: string | null;
  is_provisioned: boolean;
  is_active: boolean;
  created_at: string;
}

export default function CampaignPhoneNumbersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [assignedNumbers, setAssignedNumbers] = useState<PhoneNumber[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<PhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<string>("draft");

  // New phone number form
  const [newNumber, setNewNumber] = useState({
    phone_number: "",
    friendly_name: "",
  });

  const { toast } = useToast();

  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/phone-numbers`);
      if (!response.ok) throw new Error("Failed to fetch phone numbers");
      const data = await response.json();
      setAssignedNumbers(data.assigned || []);
      setAvailableNumbers(data.available || []);

      // Also fetch campaign status
      const campaignResponse = await fetch(`/api/admin/outbound-campaigns/${id}`);
      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        setCampaignStatus(campaignData.status);
      }
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      toast({
        title: "Error",
        description: "Failed to load phone numbers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhoneNumbers();
  }, [id]);

  const handleAddNumber = async () => {
    if (!newNumber.phone_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/phone-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: newNumber.phone_number,
          friendly_name: newNumber.friendly_name || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add phone number");
      }

      toast({ title: "Success", description: "Phone number added successfully" });
      setShowAddForm(false);
      setNewNumber({ phone_number: "", friendly_name: "" });
      fetchPhoneNumbers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add phone number",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignNumber = async (phoneNumberId: string) => {
    // Find the phone number to get its details
    const phone = availableNumbers.find((p) => p.id === phoneNumberId);
    if (!phone) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/phone-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone.phone_number,
          friendly_name: phone.friendly_name,
          twilio_sid: phone.twilio_sid,
          vapi_phone_id: phone.vapi_phone_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign phone number");
      }

      toast({ title: "Success", description: "Phone number assigned to campaign" });
      fetchPhoneNumbers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign phone number",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveNumber = async (phoneNumberId: string) => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/phone-numbers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number_id: phoneNumberId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove phone number");
      }

      toast({ title: "Success", description: "Phone number removed from campaign" });
      fetchPhoneNumbers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove phone number",
        variant: "destructive",
      });
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Format +1XXXXXXXXXX to (XXX) XXX-XXXX
    if (phone.startsWith("+1") && phone.length === 12) {
      const digits = phone.slice(2);
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const isDraft = campaignStatus === "draft";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/outbound/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage phone numbers for outbound calls
          </p>
        </div>
      </div>

      {!isDraft && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Phone numbers can only be modified for draft campaigns
          </p>
        </div>
      )}

      {/* Assigned Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Assigned Phone Numbers
          </CardTitle>
          <CardDescription>
            Phone numbers currently assigned to this campaign for outbound calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignedNumbers.length > 0 ? (
            <div className="space-y-3">
              {assignedNumbers.map((phone) => (
                <div
                  key={phone.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <Phone className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{formatPhoneNumber(phone.phone_number)}</p>
                      {phone.friendly_name && (
                        <p className="text-sm text-muted-foreground">{phone.friendly_name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {phone.provider}
                        </Badge>
                        {phone.is_active ? (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {isDraft && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Phone Number?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will unassign {formatPhoneNumber(phone.phone_number)} from this
                            campaign. The phone number will remain available for other campaigns.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveNumber(phone.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No phone numbers assigned</p>
              <p className="text-sm">Add a phone number to make outbound calls</p>
            </div>
          )}

          {/* Add Number Form */}
          {isDraft && showAddForm ? (
            <Card className="border-dashed">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Add New Phone Number</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewNumber({ phone_number: "", friendly_name: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      value={newNumber.phone_number}
                      onChange={(e) =>
                        setNewNumber({ ...newNumber, phone_number: e.target.value })
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter in any format - will be normalized to E.164
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Friendly Name</Label>
                    <Input
                      value={newNumber.friendly_name}
                      onChange={(e) =>
                        setNewNumber({ ...newNumber, friendly_name: e.target.value })
                      }
                      placeholder="Main Office Line"
                    />
                  </div>
                </div>

                <Button onClick={handleAddNumber} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Add Phone Number
                </Button>
              </CardContent>
            </Card>
          ) : (
            isDraft && (
              <Button variant="outline" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Phone Number
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Available Numbers (from client) */}
      {isDraft && availableNumbers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Phone Numbers</CardTitle>
            <CardDescription>
              Phone numbers from this client that can be assigned to this campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {availableNumbers.map((phone) => (
                <div
                  key={phone.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-full">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{formatPhoneNumber(phone.phone_number)}</p>
                      {phone.friendly_name && (
                        <p className="text-sm text-muted-foreground">{phone.friendly_name}</p>
                      )}
                      <Badge variant="outline" className="text-xs mt-1">
                        {phone.provider}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignNumber(phone.id)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Assign
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

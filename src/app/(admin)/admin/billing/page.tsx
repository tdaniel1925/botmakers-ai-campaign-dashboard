"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Loader2, DollarSign, Phone, Zap, Database } from "lucide-react";

interface BillingRate {
  id: string;
  rate_type: string;
  display_name: string;
  description: string | null;
  unit_price: string;
  unit_name: string;
  minimum_charge: string | null;
  free_allowance: number | null;
  is_active: boolean;
}

const DEFAULT_RATES = [
  {
    rate_type: "call_minutes",
    display_name: "Call Minutes",
    description: "Per minute charge for AI call processing",
    unit_price: "0.05",
    unit_name: "minute",
    minimum_charge: "0",
    free_allowance: 0,
  },
  {
    rate_type: "api_calls",
    display_name: "API Calls",
    description: "Per call charge for API requests",
    unit_price: "0.001",
    unit_name: "call",
    minimum_charge: "0",
    free_allowance: 1000,
  },
  {
    rate_type: "workflows",
    display_name: "Workflow Executions",
    description: "Per execution charge for automated workflows",
    unit_price: "0.02",
    unit_name: "execution",
    minimum_charge: "0",
    free_allowance: 100,
  },
];

export default function BillingRatesPage() {
  const [rates, setRates] = useState<BillingRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<BillingRate | null>(null);
  const [formData, setFormData] = useState({
    rateType: "",
    displayName: "",
    description: "",
    unitPrice: "",
    unitName: "",
    minimumCharge: "0",
    freeAllowance: "0",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("billing_rates")
        .select("*")
        .order("display_name", { ascending: true });

      if (error) throw error;
      setRates(data || []);
    } catch (error) {
      console.error("Error fetching rates:", error);
      toast({
        title: "Error",
        description: "Failed to load billing rates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      for (const rate of DEFAULT_RATES) {
        const { error } = await supabase
          .from("billing_rates")
          .upsert(rate, { onConflict: "rate_type" });

        if (error) throw error;
      }

      toast({ title: "Success", description: "Default rates created" });
      fetchRates();
    } catch (error) {
      console.error("Error seeding rates:", error);
      toast({
        title: "Error",
        description: "Failed to create default rates",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenDialog = (rate?: BillingRate) => {
    if (rate) {
      setEditingRate(rate);
      setFormData({
        rateType: rate.rate_type,
        displayName: rate.display_name,
        description: rate.description || "",
        unitPrice: rate.unit_price,
        unitName: rate.unit_name,
        minimumCharge: rate.minimum_charge || "0",
        freeAllowance: rate.free_allowance?.toString() || "0",
      });
    } else {
      setEditingRate(null);
      setFormData({
        rateType: "",
        displayName: "",
        description: "",
        unitPrice: "",
        unitName: "",
        minimumCharge: "0",
        freeAllowance: "0",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.rateType || !formData.displayName || !formData.unitPrice || !formData.unitName) {
      toast({
        title: "Validation Error",
        description: "Rate type, display name, unit price, and unit name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const rateData = {
        rate_type: formData.rateType,
        display_name: formData.displayName,
        description: formData.description || null,
        unit_price: formData.unitPrice,
        unit_name: formData.unitName,
        minimum_charge: formData.minimumCharge || "0",
        free_allowance: parseInt(formData.freeAllowance) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingRate) {
        const { error } = await supabase
          .from("billing_rates")
          .update(rateData)
          .eq("id", editingRate.id);

        if (error) throw error;
        toast({ title: "Success", description: "Rate updated successfully" });
      } else {
        const { error } = await supabase
          .from("billing_rates")
          .insert(rateData);

        if (error) throw error;
        toast({ title: "Success", description: "Rate created successfully" });
      }

      setIsDialogOpen(false);
      fetchRates();
    } catch (error) {
      console.error("Error saving rate:", error);
      toast({
        title: "Error",
        description: "Failed to save rate",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (rate: BillingRate) => {
    try {
      const { error } = await supabase
        .from("billing_rates")
        .update({ is_active: !rate.is_active })
        .eq("id", rate.id);

      if (error) throw error;
      fetchRates();
      toast({
        title: "Success",
        description: `Rate ${rate.is_active ? "disabled" : "enabled"}`,
      });
    } catch (error) {
      console.error("Error toggling rate:", error);
      toast({
        title: "Error",
        description: "Failed to update rate",
        variant: "destructive",
      });
    }
  };

  const getRateIcon = (rateType: string) => {
    switch (rateType) {
      case "call_minutes":
        return <Phone className="h-4 w-4" />;
      case "api_calls":
        return <Zap className="h-4 w-4" />;
      case "workflows":
        return <Database className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing Rates</h1>
          <p className="text-muted-foreground">
            Configure usage-based pricing for calls, API, and workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rates.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults} disabled={isSeeding}>
              {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Default Rates
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingRate ? "Edit Rate" : "Create Rate"}
                </DialogTitle>
                <DialogDescription>
                  {editingRate
                    ? "Update the billing rate configuration"
                    : "Create a new usage-based billing rate"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="rateType">Rate Type (ID)</Label>
                    <Input
                      id="rateType"
                      value={formData.rateType}
                      onChange={(e) =>
                        setFormData({ ...formData, rateType: e.target.value })
                      }
                      placeholder="e.g., call_minutes"
                      disabled={!!editingRate}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) =>
                        setFormData({ ...formData, displayName: e.target.value })
                      }
                      placeholder="e.g., Call Minutes"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="e.g., Per minute charge for AI calls"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="unitPrice">Price per Unit ($)</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      step="0.0001"
                      value={formData.unitPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, unitPrice: e.target.value })
                      }
                      placeholder="0.05"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="unitName">Unit Name</Label>
                    <Input
                      id="unitName"
                      value={formData.unitName}
                      onChange={(e) =>
                        setFormData({ ...formData, unitName: e.target.value })
                      }
                      placeholder="e.g., minute, call, execution"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="minimumCharge">Minimum Monthly Charge ($)</Label>
                    <Input
                      id="minimumCharge"
                      type="number"
                      step="0.01"
                      value={formData.minimumCharge}
                      onChange={(e) =>
                        setFormData({ ...formData, minimumCharge: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="freeAllowance">Free Allowance (units)</Label>
                    <Input
                      id="freeAllowance"
                      type="number"
                      value={formData.freeAllowance}
                      onChange={(e) =>
                        setFormData({ ...formData, freeAllowance: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRate ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rates</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rates.filter((r) => r.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently billing clients
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call Rate</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${rates.find((r) => r.rate_type === "call_minutes")?.unit_price || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Per minute
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${rates.find((r) => r.rate_type === "api_calls")?.unit_price || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Per API call
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage-Based Rates</CardTitle>
          <CardDescription>
            Clients are charged based on their actual usage. Configure rates for different billable activities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : rates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Free Allowance</TableHead>
                  <TableHead>Min. Charge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRateIcon(rate.rate_type)}
                        <div>
                          <div className="font-medium">{rate.display_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {rate.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        ${parseFloat(rate.unit_price).toFixed(4)}
                      </span>
                      <span className="text-muted-foreground">/{rate.unit_name}</span>
                    </TableCell>
                    <TableCell>
                      {rate.free_allowance ? (
                        <span>{rate.free_allowance} {rate.unit_name}s</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {parseFloat(rate.minimum_charge || "0") > 0 ? (
                        <span>${rate.minimum_charge}/mo</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rate.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(rate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={rate.is_active}
                          onCheckedChange={() => handleToggleActive(rate)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No billing rates configured yet.</p>
              <p className="text-sm">Click &quot;Create Default Rates&quot; to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

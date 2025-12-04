"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Loader2,
  Plus,
  Trash2,
  Phone,
  Zap,
  Workflow,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

interface BillingRate {
  id: string;
  rate_type: string;
  display_name: string;
  description: string | null;
  unit_price: string;
  unit_name: string;
  free_allowance: number;
}

interface PaymentMethod {
  id: string;
  payment_provider: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_default: boolean;
  is_valid: boolean;
}

interface BillingAccount {
  current_balance: string;
  status: string;
  auto_charge_threshold: string;
  auto_charge_enabled: boolean;
  last_charge_at: string | null;
  last_charge_amount: string | null;
}

interface UsageSummary {
  rate_type: string;
  display_name: string;
  total_quantity: number;
  total_amount: number;
  unit_name: string;
}

interface Invoice {
  id: string;
  amount: string;
  status: string;
  payment_provider: string | null;
  created_at: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
}

type PaymentProvider = "stripe" | "paypal" | "square";

export default function BillingPage() {
  const [rates, setRates] = useState<BillingRate[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [billingAccount, setBillingAccount] = useState<BillingAccount | null>(null);
  const [usageSummary, setUsageSummary] = useState<UsageSummary[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get client
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!client) return;

      // Fetch all data in parallel
      const [
        ratesRes,
        methodsRes,
        accountRes,
        invoicesRes,
        usageRes,
      ] = await Promise.all([
        // Get billing rates
        supabase
          .from("billing_rates")
          .select("*")
          .eq("is_active", true)
          .order("rate_type"),
        // Get payment methods
        supabase
          .from("client_payment_methods")
          .select("*")
          .eq("client_id", client.id)
          .order("is_default", { ascending: false }),
        // Get billing account
        supabase
          .from("client_billing_accounts")
          .select("*")
          .eq("client_id", client.id)
          .single(),
        // Get billing history
        supabase
          .from("billing_history")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(10),
        // Get current month usage summary
        supabase
          .from("usage_records")
          .select("rate_type, quantity, total_amount")
          .eq("client_id", client.id)
          .eq("billing_period", format(new Date(), "yyyy-MM")),
      ]);

      setRates(ratesRes.data || []);
      setPaymentMethods(methodsRes.data || []);
      setBillingAccount(accountRes.data);
      setInvoices(invoicesRes.data || []);

      // Aggregate usage by rate type
      if (usageRes.data) {
        const usageMap = new Map<string, { quantity: number; amount: number }>();
        usageRes.data.forEach((record) => {
          const existing = usageMap.get(record.rate_type) || { quantity: 0, amount: 0 };
          usageMap.set(record.rate_type, {
            quantity: existing.quantity + parseFloat(record.quantity),
            amount: existing.amount + parseFloat(record.total_amount),
          });
        });

        const summary: UsageSummary[] = [];
        ratesRes.data?.forEach((rate) => {
          const usage = usageMap.get(rate.rate_type);
          // Always show all rate types so users can see pricing
          summary.push({
            rate_type: rate.rate_type,
            display_name: rate.display_name,
            total_quantity: usage?.quantity || 0,
            total_amount: usage?.amount || 0,
            unit_name: rate.unit_name,
          });
        });
        setUsageSummary(summary);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPaymentMethod = async (provider: PaymentProvider) => {
    setShowAddCardDialog(false);
    setIsAddingCard(true);

    try {
      const response = await fetch(`/api/payments/${provider}/setup-intent`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.clientSecret) {
        // For Stripe Elements integration - redirect to card setup page
        window.location.href = `/dashboard/billing/add-card?provider=${provider}&setup_intent=${data.clientSecret}`;
      } else {
        throw new Error(data.error || "Failed to create setup session");
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to start payment method setup",
        variant: "destructive",
      });
    } finally {
      setIsAddingCard(false);
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    setIsDeletingCard(methodId);

    try {
      const response = await fetch(`/api/payments/payment-methods/${methodId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete payment method");
      }

      toast({
        title: "Payment method removed",
        description: "Your payment method has been deleted",
      });

      fetchBillingData();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete payment method",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCard(null);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const response = await fetch(`/api/payments/payment-methods/${methodId}/default`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to set default payment method");
      }

      toast({
        title: "Default updated",
        description: "Your default payment method has been updated",
      });

      fetchBillingData();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to update default payment method",
        variant: "destructive",
      });
    }
  };

  const getRateIcon = (rateType: string) => {
    switch (rateType) {
      case "call_minutes":
        return <Phone className="h-5 w-5" />;
      case "api_calls":
        return <Zap className="h-5 w-5" />;
      case "workflows":
        return <Workflow className="h-5 w-5" />;
      default:
        return <DollarSign className="h-5 w-5" />;
    }
  };

  const getProviderIcon = (provider: string | null) => {
    switch (provider) {
      case "paypal":
        return <Wallet className="h-4 w-4" />;
      case "square":
        return <Building2 className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentBalance = parseFloat(billingAccount?.current_balance || "0");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your payment methods and view usage
        </p>
      </div>

      {/* Account Status & Balance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${currentBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending charges this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {billingAccount?.status === "active" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              {getStatusBadge(billingAccount?.status || "active")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {billingAccount?.auto_charge_enabled
                ? `Auto-charge at $${billingAccount.auto_charge_threshold}`
                : "Auto-charge disabled"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {billingAccount?.last_charge_at ? (
              <>
                <div className="text-3xl font-bold">
                  ${parseFloat(billingAccount.last_charge_amount || "0").toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(billingAccount.last_charge_at), "MMM d, yyyy")}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">No payments yet</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Add a card to enable usage-based billing
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddCardDialog(true)} disabled={isAddingCard}>
              {isAddingCard ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8 border rounded-lg border-dashed">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-semibold">No payment method</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add a payment method to start using our services
              </p>
              <Button
                className="mt-4"
                onClick={() => setShowAddCardDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-md">
                      {getProviderIcon(method.payment_provider)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {method.card_brand || method.payment_provider}
                        </span>
                        {method.card_last4 && (
                          <span className="text-muted-foreground">
                            •••• {method.card_last4}
                          </span>
                        )}
                        {method.is_default && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                        {!method.is_valid && (
                          <Badge variant="destructive" className="text-xs">
                            Invalid
                          </Badge>
                        )}
                      </div>
                      {method.card_exp_month && method.card_exp_year && (
                        <p className="text-sm text-muted-foreground">
                          Expires {method.card_exp_month}/{method.card_exp_year}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      disabled={isDeletingCard === method.id}
                    >
                      {isDeletingCard === method.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddCardDialog} onOpenChange={setShowAddCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Choose how you would like to pay
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => handleAddPaymentMethod("stripe")}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-md bg-muted">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Credit/Debit Card</div>
                  <div className="text-sm text-muted-foreground">
                    Pay securely with Stripe
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => handleAddPaymentMethod("paypal")}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-md bg-muted">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">PayPal</div>
                  <div className="text-sm text-muted-foreground">
                    Link your PayPal account
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => handleAddPaymentMethod("square")}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-md bg-muted">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Square</div>
                  <div className="text-sm text-muted-foreground">
                    Pay with Square
                  </div>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddCardDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            Usage for {format(new Date(), "MMMM yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageSummary.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No usage recorded this period
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {usageSummary.map((usage) => (
                <div
                  key={usage.rate_type}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="p-3 bg-muted rounded-lg">
                    {getRateIcon(usage.rate_type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{usage.display_name}</p>
                    <p className="text-2xl font-bold">
                      {usage.total_quantity.toFixed(usage.unit_name === "minute" ? 1 : 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {usage.unit_name}s used • ${usage.total_amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Current billing rates</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Free Allowance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRateIcon(rate.rate_type)}
                      <div>
                        <p className="font-medium">{rate.display_name}</p>
                        {rate.description && (
                          <p className="text-xs text-muted-foreground">
                            {rate.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    ${parseFloat(rate.unit_price).toFixed(4)}/{rate.unit_name}
                  </TableCell>
                  <TableCell>
                    {rate.free_allowance > 0
                      ? `${rate.free_allowance} ${rate.unit_name}s/month`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Billing History */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Your past invoices and payments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {format(new Date(invoice.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {invoice.description || "Usage charges"}
                      {invoice.period_start && invoice.period_end && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(invoice.period_start), "MMM d")} -{" "}
                          {format(new Date(invoice.period_end), "MMM d, yyyy")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getProviderIcon(invoice.payment_provider)}
                      </div>
                    </TableCell>
                    <TableCell>${parseFloat(invoice.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={invoice.status === "paid" ? "success" : "secondary"}
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Key,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Trash2,
  RefreshCw,
  Database,
  FileCode,
  Plug,
  CreditCard,
  Calendar,
  Mail,
  Phone,
  Bot,
  Sparkles,
} from "lucide-react";

interface ServiceField {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "password" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface ServiceConfig {
  name: string;
  description: string;
  fields: ServiceField[];
}

interface ServiceStatus {
  service: string;
  name: string;
  description: string;
  isConfigured: boolean;
  source: "database" | "env" | null;
  isActive: boolean;
  lastValidated: string | null;
  validationStatus: string | null;
  updatedAt: string | null;
}

const serviceIcons: Record<string, React.ReactNode> = {
  openai: <Sparkles className="h-5 w-5" />,
  vapi: <Bot className="h-5 w-5" />,
  resend: <Mail className="h-5 w-5" />,
  twilio: <Phone className="h-5 w-5" />,
  cal_com: <Calendar className="h-5 w-5" />,
  google_calendar: <Calendar className="h-5 w-5" />,
  outlook_calendar: <Calendar className="h-5 w-5" />,
  stripe: <CreditCard className="h-5 w-5" />,
  square: <CreditCard className="h-5 w-5" />,
  paypal: <CreditCard className="h-5 w-5" />,
};

const serviceCategories = [
  {
    name: "AI & Communication",
    services: ["openai", "vapi", "resend", "twilio"],
  },
  {
    name: "Calendar Integrations",
    services: ["cal_com", "google_calendar", "outlook_calendar"],
  },
  {
    name: "Payment Processing",
    services: ["stripe", "square", "paypal"],
  },
];

export default function ApiKeysPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig | null>(null);
  const [keyData, setKeyData] = useState<Record<string, string>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loadingService, setLoadingService] = useState<string | null>(null);

  // Fetch services status
  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/api-keys");
      const data = await response.json();
      if (data.services) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      showNotification("error", "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open configure dialog for a service
  const openConfigureDialog = async (service: string) => {
    setSelectedService(service);
    setLoadingService(service);
    try {
      const response = await fetch(`/api/admin/api-keys/${service}`);
      const data = await response.json();

      setServiceConfig(data.config);
      setKeyData(data.keyData || {});
      setShowPasswords({});
      setShowDialog(true);
    } catch (error) {
      console.error("Error fetching service config:", error);
      showNotification("error", "Failed to load service configuration");
    } finally {
      setLoadingService(null);
    }
  };

  // Handle field change
  const handleFieldChange = (key: string, value: string) => {
    setKeyData((prev) => ({ ...prev, [key]: value }));
  };

  // Toggle password visibility
  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Save API keys
  const handleSave = async () => {
    if (!selectedService) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: selectedService,
          keyData,
          validate: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.validationStatus === "valid") {
          showNotification("success", `${serviceConfig?.name} keys saved and validated successfully`);
        } else {
          showNotification("error", `Keys saved but validation failed: ${data.validationError}`);
        }
        setShowDialog(false);
        fetchServices();
      } else {
        showNotification("error", data.error || "Failed to save keys");
      }
    } catch (error) {
      console.error("Error saving keys:", error);
      showNotification("error", "Failed to save keys");
    } finally {
      setSaving(false);
    }
  };

  // Validate existing keys
  const handleValidate = async (service: string) => {
    setValidating(true);
    setLoadingService(service);
    try {
      const response = await fetch(`/api/admin/api-keys/${service}`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.valid) {
        showNotification("success", "API keys are valid");
      } else {
        showNotification("error", `Validation failed: ${data.error}`);
      }
      fetchServices();
    } catch (error) {
      console.error("Error validating keys:", error);
      showNotification("error", "Failed to validate keys");
    } finally {
      setValidating(false);
      setLoadingService(null);
    }
  };

  // Delete API keys
  const handleDelete = async () => {
    if (!selectedService) return;

    try {
      const response = await fetch(`/api/admin/api-keys/${selectedService}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showNotification("success", "API keys removed. Now using .env fallback if available.");
        setShowDeleteDialog(false);
        setShowDialog(false);
        fetchServices();
      } else {
        const data = await response.json();
        showNotification("error", data.error || "Failed to delete keys");
      }
    } catch (error) {
      console.error("Error deleting keys:", error);
      showNotification("error", "Failed to delete keys");
    }
  };

  // Toggle service active status
  const handleToggleActive = async (service: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/api-keys/${service}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        showNotification("success", `Service ${isActive ? "enabled" : "disabled"}`);
        fetchServices();
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      showNotification("error", "Failed to update service status");
    }
  };

  const getStatusBadge = (service: ServiceStatus) => {
    if (!service.isConfigured) {
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Not Configured
        </Badge>
      );
    }

    if (service.validationStatus === "valid") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 gap-1">
          <CheckCircle className="h-3 w-3" />
          Valid
        </Badge>
      );
    }

    if (service.validationStatus === "invalid") {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 gap-1">
          <XCircle className="h-3 w-3" />
          Invalid
        </Badge>
      );
    }

    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 gap-1">
        <AlertCircle className="h-3 w-3" />
        Pending
      </Badge>
    );
  };

  const getSourceBadge = (source: string | null) => {
    if (source === "database") {
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <Database className="h-3 w-3" />
          Database
        </Badge>
      );
    }
    if (source === "env") {
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <FileCode className="h-3 w-3" />
          .env
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API connections for external services. Database keys override .env settings.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchServices()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`flex items-center gap-2 rounded-lg p-4 ${
            notification.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2 h-fit">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">How API Keys Work</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                API keys saved here will override any keys set in your .env file. If you remove
                database keys, the system will fall back to .env values. This allows you to manage
                keys without redeploying your application.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Categories */}
      {serviceCategories.map((category) => (
        <div key={category.name} className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {category.name === "AI & Communication" && <Sparkles className="h-5 w-5 text-purple-500" />}
            {category.name === "Calendar Integrations" && <Calendar className="h-5 w-5 text-blue-500" />}
            {category.name === "Payment Processing" && <CreditCard className="h-5 w-5 text-green-500" />}
            {category.name}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {category.services.map((serviceKey) => {
              const service = services.find((s) => s.service === serviceKey);
              if (!service) return null;

              return (
                <Card key={service.service} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          {serviceIcons[service.service]}
                        </div>
                        <div>
                          <CardTitle className="text-base">{service.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {service.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(service)}
                      {getSourceBadge(service.source)}
                    </div>

                    {service.isConfigured && service.source === "database" && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Switch
                          checked={service.isActive}
                          onCheckedChange={(checked) => handleToggleActive(service.service, checked)}
                        />
                      </div>
                    )}

                    {service.lastValidated && (
                      <p className="text-xs text-muted-foreground">
                        Last validated: {new Date(service.lastValidated).toLocaleString()}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openConfigureDialog(service.service)}
                        disabled={loadingService === service.service}
                      >
                        {loadingService === service.service ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Settings className="mr-2 h-4 w-4" />
                        )}
                        Configure
                      </Button>
                      {service.isConfigured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidate(service.service)}
                          disabled={validating && loadingService === service.service}
                        >
                          {validating && loadingService === service.service ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Configure Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedService && serviceIcons[selectedService]}
              Configure {serviceConfig?.name}
            </DialogTitle>
            <DialogDescription>
              {serviceConfig?.description}. All required fields must be filled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {serviceConfig?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </Label>
                {field.type === "select" ? (
                  <Select
                    value={keyData[field.key] || ""}
                    onValueChange={(value) => handleFieldChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Input
                      id={field.key}
                      type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                      value={keyData[field.key] || ""}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={field.type === "password" ? "pr-10" : ""}
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(field.key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPasswords[field.key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {services.find((s) => s.service === selectedService)?.source === "database" && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Keys
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save & Validate
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove API Keys?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the stored API keys from the database. The system will fall back
              to using keys from your .env file if available. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Keys
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

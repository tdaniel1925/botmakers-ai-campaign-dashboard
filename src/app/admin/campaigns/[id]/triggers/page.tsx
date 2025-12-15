'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MessageSquare,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SmsTrigger, Campaign } from '@/db/schema';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TriggersPage({ params }: PageProps) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [triggers, setTriggers] = useState<SmsTrigger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<SmsTrigger | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    intentDescription: '',
    smsMessage: '',
    priority: 100,
  });

  const fetchCampaign = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const result = await response.json();
      if (response.ok) {
        setCampaign(result.data);
      } else {
        toast.error(result.error || 'Campaign not found');
        router.push('/admin/campaigns');
      }
    } catch (error) {
      toast.error('Failed to fetch campaign');
      router.push('/admin/campaigns');
    }
  }, [campaignId, router]);

  const fetchTriggers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set('includeInactive', 'true');

      const response = await fetch(`/api/campaigns/${campaignId}/triggers?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch triggers');
      }

      setTriggers(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch triggers');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, showInactive]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Trigger name is required');
      return;
    }
    if (!formData.intentDescription.trim()) {
      toast.error('Intent description is required');
      return;
    }
    if (!formData.smsMessage.trim()) {
      toast.error('SMS message is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/triggers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create trigger');
      }

      toast.success('SMS trigger created successfully');
      setIsCreateOpen(false);
      setFormData({ name: '', intentDescription: '', smsMessage: '', priority: 100 });
      fetchTriggers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create trigger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTrigger) return;

    if (!formData.name.trim() || !formData.intentDescription.trim() || !formData.smsMessage.trim()) {
      toast.error('All fields are required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/triggers/${selectedTrigger.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update trigger');
      }

      toast.success('SMS trigger updated successfully');
      setIsEditOpen(false);
      setSelectedTrigger(null);
      fetchTriggers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update trigger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (trigger: SmsTrigger) => {
    try {
      const response = await fetch(`/api/triggers/${trigger.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !trigger.isActive }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update trigger');
      }

      toast.success(`Trigger ${trigger.isActive ? 'disabled' : 'enabled'} successfully`);
      fetchTriggers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update trigger');
    }
  };

  const handleDelete = async () => {
    if (!selectedTrigger) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/triggers/${selectedTrigger.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete trigger');
      }

      toast.success('SMS trigger deleted successfully');
      setIsDeleteOpen(false);
      setSelectedTrigger(null);
      fetchTriggers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete trigger');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (trigger: SmsTrigger) => {
    setSelectedTrigger(trigger);
    setFormData({
      name: trigger.name,
      intentDescription: trigger.intentDescription,
      smsMessage: trigger.smsMessage,
      priority: trigger.priority,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (trigger: SmsTrigger) => {
    setSelectedTrigger(trigger);
    setIsDeleteOpen(true);
  };

  const getSmsLengthWarning = (message: string) => {
    const length = message.length;
    if (length === 0) return null;
    if (length <= 160) return { type: 'success', text: `${length}/160 characters (1 segment)` };
    if (length <= 306) return { type: 'warning', text: `${length} characters (2 segments)` };
    if (length <= 459) return { type: 'warning', text: `${length} characters (3 segments)` };
    return { type: 'error', text: `${length} characters (${Math.ceil(length / 153)} segments) - Consider shortening` };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Triggers</h1>
          <p className="text-muted-foreground">
            {campaign ? `Campaign: ${campaign.name}` : 'Loading...'}
          </p>
        </div>
        <Button onClick={() => {
          setFormData({ name: '', intentDescription: '', smsMessage: '', priority: 100 });
          setIsCreateOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Trigger
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configured Triggers</CardTitle>
              <CardDescription>
                SMS triggers are evaluated against call transcripts and summaries. When a match is found, the corresponding SMS is sent.
              </CardDescription>
            </div>
            <Button
              variant={showInactive ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? 'Hide Inactive' : 'Show Inactive'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : triggers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No SMS triggers configured</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Create SMS triggers to automatically send messages based on caller intent detected in conversations.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Trigger
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Intent Description</TableHead>
                  <TableHead>SMS Message</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggers.map((trigger) => (
                  <TableRow key={trigger.id}>
                    <TableCell className="font-medium">{trigger.name}</TableCell>
                    <TableCell className="max-w-xs truncate" title={trigger.intentDescription}>
                      {trigger.intentDescription}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={trigger.smsMessage}>
                        {trigger.smsMessage}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {trigger.smsMessage.length} chars
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{trigger.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={trigger.isActive ? 'success' : 'secondary'}>
                        {trigger.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(trigger)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(trigger)}>
                            {trigger.isActive ? (
                              <>
                                <PowerOff className="mr-2 h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteDialog(trigger)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create SMS Trigger</DialogTitle>
            <DialogDescription>
              Define when this SMS should be sent based on caller intent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Trigger Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appointment Request"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intentDescription">Intent Description *</Label>
              <Textarea
                id="intentDescription"
                value={formData.intentDescription}
                onChange={(e) => setFormData({ ...formData, intentDescription: e.target.value })}
                placeholder="Describe the caller intent that should trigger this SMS. Be specific but not too narrow.&#10;&#10;Example: The caller expressed interest in scheduling an appointment or consultation."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The AI will evaluate call transcripts and summaries against this description to decide whether to send the SMS.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smsMessage">SMS Message *</Label>
              <Textarea
                id="smsMessage"
                value={formData.smsMessage}
                onChange={(e) => setFormData({ ...formData, smsMessage: e.target.value })}
                placeholder="Enter the SMS message to send. Keep it concise and include a clear call-to-action."
                rows={4}
              />
              {(() => {
                const warning = getSmsLengthWarning(formData.smsMessage);
                if (!warning) return null;
                return (
                  <div className={`flex items-center gap-2 text-xs ${
                    warning.type === 'success' ? 'text-green-600' :
                    warning.type === 'warning' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {warning.type !== 'success' && <AlertTriangle className="h-3 w-3" />}
                    {warning.text}
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground">
                Standard SMS is 160 characters. Longer messages are split into multiple segments and may cost more.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={1000}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers = higher priority. When multiple triggers match, lower priority triggers are evaluated first.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Trigger'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit SMS Trigger</DialogTitle>
            <DialogDescription>
              Update the trigger settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Trigger Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appointment Request"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-intentDescription">Intent Description *</Label>
              <Textarea
                id="edit-intentDescription"
                value={formData.intentDescription}
                onChange={(e) => setFormData({ ...formData, intentDescription: e.target.value })}
                placeholder="Describe the caller intent that should trigger this SMS."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-smsMessage">SMS Message *</Label>
              <Textarea
                id="edit-smsMessage"
                value={formData.smsMessage}
                onChange={(e) => setFormData({ ...formData, smsMessage: e.target.value })}
                placeholder="Enter the SMS message to send."
                rows={4}
              />
              {(() => {
                const warning = getSmsLengthWarning(formData.smsMessage);
                if (!warning) return null;
                return (
                  <div className={`flex items-center gap-2 text-xs ${
                    warning.type === 'success' ? 'text-green-600' :
                    warning.type === 'warning' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {warning.type !== 'success' && <AlertTriangle className="h-3 w-3" />}
                    {warning.text}
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Input
                id="edit-priority"
                type="number"
                min={1}
                max={1000}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMS Trigger</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedTrigger?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

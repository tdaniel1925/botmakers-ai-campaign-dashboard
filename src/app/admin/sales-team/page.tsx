'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Loader2,
  Plus,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  DollarSign,
  Target,
  Eye,
  Send,
  Save,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatDateTime, formatCurrency } from '@/lib/utils';

interface SalesUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  commissionRate: number;
  isActive: boolean;
  createdAt: string;
  leadStats: { total: number; won: number };
  commissionStats: { total: number; pending: number };
}

type CreateStep = 'details' | 'preview';

interface EmailPreview {
  subject: string;
  html: string;
  to: string;
  from: string;
  temporaryPassword: string;
}

export default function SalesTeamPage() {
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogUser, setDeleteDialogUser] = useState<SalesUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<SalesUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    fullName: '',
    phone: '',
    password: '',
    commissionRate: 18,
  });
  const [createStep, setCreateStep] = useState<CreateStep>('details');
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    commissionRate: 18,
    isActive: true,
  });

  useEffect(() => {
    fetchSalesTeam();
  }, []);

  const fetchSalesTeam = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/sales-team');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSalesUsers(data);
    } catch (error) {
      toast.error('Failed to load sales team');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailPreview = async () => {
    if (!createForm.email || !createForm.fullName || !createForm.password) {
      toast.error('Please fill in all required fields');
      return false;
    }

    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/admin/sales-team/preview-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email,
          fullName: createForm.fullName,
          password: createForm.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate preview');
      }

      setEmailPreview(result);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate preview');
      return false;
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleNextStep = async () => {
    if (createStep === 'details') {
      const success = await fetchEmailPreview();
      if (success) {
        setCreateStep('preview');
      }
    }
  };

  const handleCreate = async (sendEmail: boolean) => {
    if (!emailPreview) {
      toast.error('Please preview the email first');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/sales-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          password: emailPreview.temporaryPassword,
          sendEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create');
      }

      if (sendEmail) {
        toast.success('Sales user created and welcome email sent');
      } else {
        toast.success('Sales user created (email not sent)');
      }
      closeCreateDialog();
      fetchSalesTeam();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create sales user');
    } finally {
      setIsSaving(false);
    }
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setCreateStep('details');
    setEmailPreview(null);
    setCreateForm({
      email: '',
      fullName: '',
      phone: '',
      password: '',
      commissionRate: 18,
    });
  };

  const handleEdit = async () => {
    if (!selectedUser) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/admin/sales-team/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error('Failed to update');

      toast.success('Sales user updated successfully');
      setIsEditDialogOpen(false);
      fetchSalesTeam();
    } catch (error) {
      toast.error('Failed to update sales user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialogUser) return;

    try {
      const response = await fetch(`/api/admin/sales-team/${deleteDialogUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      const result = await response.json();
      toast.success(result.message);
      setDeleteDialogUser(null);
      fetchSalesTeam();
    } catch (error) {
      toast.error('Failed to delete sales user');
    }
  };

  const openEditDialog = (user: SalesUser) => {
    setSelectedUser(user);
    setEditForm({
      fullName: user.fullName,
      phone: user.phone || '',
      commissionRate: user.commissionRate,
      isActive: user.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const filteredUsers = salesUsers.filter((user) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.fullName.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  // Calculate totals
  const totalLeads = salesUsers.reduce((sum, u) => sum + u.leadStats.total, 0);
  const totalWon = salesUsers.reduce((sum, u) => sum + u.leadStats.won, 0);
  const totalPendingCommissions = salesUsers.reduce(
    (sum, u) => sum + u.commissionStats.pending,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Team</h1>
          <p className="text-muted-foreground">
            Manage your affiliate and sales team members
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Sales User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesUsers.length}</div>
            <p className="text-xs text-muted-foreground">
              {salesUsers.filter((u) => u.isActive).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">{totalWon} won</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totalPendingCommissions / 100)}
            </div>
            <p className="text-xs text-muted-foreground">awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">lead to deal</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Team Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales team members found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium text-center">Leads</th>
                    <th className="pb-3 font-medium text-center">Won</th>
                    <th className="pb-3 font-medium text-center">Rate</th>
                    <th className="pb-3 font-medium text-right">Commissions</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="text-sm">
                      <td className="py-3 font-medium">{user.fullName}</td>
                      <td className="py-3 text-muted-foreground">{user.email}</td>
                      <td className="py-3 text-center">{user.leadStats.total}</td>
                      <td className="py-3 text-center text-green-600">
                        {user.leadStats.won}
                      </td>
                      <td className="py-3 text-center">{user.commissionRate}%</td>
                      <td className="py-3 text-right">
                        <div className="font-medium">
                          {formatCurrency(user.commissionStats.total / 100)}
                        </div>
                        {user.commissionStats.pending > 0 && (
                          <div className="text-xs text-amber-600">
                            {formatCurrency(user.commissionStats.pending / 100)} pending
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {user.isActive ? (
                          <Badge variant="default" className="gap-1">
                            <UserCheck className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <UserX className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteDialogUser(user)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog - Multi-step */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {createStep === 'details' ? 'Add Sales User' : 'Preview Welcome Email'}
            </DialogTitle>
            <DialogDescription>
              {createStep === 'details'
                ? 'Create a new sales team member account'
                : 'Review the email that will be sent to the new sales user.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-4 py-2">
            <div className={`flex items-center gap-2 ${createStep === 'details' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                createStep === 'details' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Details</span>
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-2 ${createStep === 'preview' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                createStep === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Preview & Send</span>
            </div>
          </div>

          {createStep === 'details' ? (
            /* Step 1: User Details */
            <div className="space-y-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email *</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    placeholder="sales@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">Full Name *</Label>
                  <Input
                    id="create-name"
                    value={createForm.fullName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, fullName: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-password">Password *</Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, password: e.target.value })
                    }
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-phone">Phone</Label>
                  <Input
                    id="create-phone"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-rate">Commission Rate (%)</Label>
                <Input
                  id="create-rate"
                  type="number"
                  min="0"
                  max="100"
                  value={createForm.commissionRate}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      commissionRate: parseInt(e.target.value) || 18,
                    })
                  }
                />
              </div>
            </div>
          ) : (
            /* Step 2: Email Preview */
            <div className="space-y-4 py-4">
              {emailPreview ? (
                <>
                  {/* Password display for admin */}
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      Generated Password:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-sm border">
                        {emailPreview.temporaryPassword}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(emailPreview.temporaryPassword);
                          toast.success('Password copied to clipboard');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground">To:</span>
                      <span>{emailPreview.to}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground">Subject:</span>
                      <span>{emailPreview.subject}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Email Preview</span>
                    </div>
                    <div className="p-4 bg-white max-h-[300px] overflow-y-auto">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {createStep === 'details' ? (
              <>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button onClick={handleNextStep} disabled={isLoadingPreview}>
                  {isLoadingPreview ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Preview...
                    </>
                  ) : (
                    <>
                      Preview Email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateStep('details')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex-1" />
                <Button
                  variant="secondary"
                  onClick={() => handleCreate(false)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Create Only
                </Button>
                <Button onClick={() => handleCreate(true)} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Create & Send Email
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sales User</DialogTitle>
            <DialogDescription>Update sales user information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm({ ...editForm, fullName: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rate">Commission Rate (%)</Label>
                <Input
                  id="edit-rate"
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.commissionRate}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      commissionRate: parseInt(e.target.value) || 18,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editForm.isActive}
                onChange={(e) =>
                  setEditForm({ ...editForm, isActive: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
      <AlertDialog
        open={!!deleteDialogUser}
        onOpenChange={() => setDeleteDialogUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteDialogUser?.fullName}? This
              action cannot be undone. If they have associated leads, they will
              be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

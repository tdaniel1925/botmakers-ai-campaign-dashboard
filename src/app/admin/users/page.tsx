'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
  KeyRound,
  Loader2,
  Mail,
  Building2,
  Shield,
  User,
  Eye,
  Send,
  Save,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { User as UserType, Organization } from '@/db/schema';

type UserWithOrg = UserType & {
  organization: Organization | null;
};

type CreateStep = 'details' | 'preview';

interface EmailPreview {
  subject: string;
  html: string;
  to: string;
  from: string;
  temporaryPassword: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithOrg[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithOrg | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Multi-step create state
  const [createStep, setCreateStep] = useState<CreateStep>('details');
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: 'client_user' as 'admin' | 'client_user',
    organizationId: '',
  });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (orgFilter !== 'all') params.set('organizationId', orgFilter);
      if (showArchived) params.set('includeArchived', 'true');

      const response = await fetch(`/api/users?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users');
      }

      setUsers(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, orgFilter, showArchived]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations');
      const result = await response.json();
      if (response.ok) {
        setOrganizations(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const fetchEmailPreview = async () => {
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return false;
    }

    if (formData.role === 'client_user' && !formData.organizationId) {
      toast.error('Organization is required for client users');
      return false;
    }

    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/users/preview-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName || null,
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

    setIsSaving(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName || null,
          role: formData.role,
          organizationId: formData.role === 'client_user' ? formData.organizationId : null,
          sendCredentials: sendEmail,
          password: emailPreview.temporaryPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      if (sendEmail) {
        toast.success('User created and credentials sent via email');
      } else {
        toast.success('User created successfully');
      }
      closeCreateDialog();
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    if (formData.role === 'client_user' && !formData.organizationId) {
      toast.error('Organization is required for client users');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName || null,
          role: formData.role,
          organizationId: formData.role === 'client_user' ? formData.organizationId : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user');
      }

      toast.success('User updated successfully');
      setIsEditOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (user: UserWithOrg) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to archive user');
      }

      toast.success('User archived successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive user');
    }
  };

  const handleRestore = async (user: UserWithOrg) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to restore user');
      }

      toast.success('User restored successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore user');
    }
  };

  const handleResetPassword = async (sendEmail: boolean) => {
    if (!selectedUser) return;

    setIsSaving(true);
    setTempPassword(null);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      if (result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
        toast.success('Password reset! Copy the temporary password below.');
      } else {
        toast.success('Password reset and new credentials sent via email');
        setIsResetPasswordOpen(false);
        setSelectedUser(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (user: UserWithOrg) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      fullName: user.fullName || '',
      role: user.role,
      organizationId: user.organizationId || '',
    });
    setIsEditOpen(true);
  };

  const openResetPasswordDialog = (user: UserWithOrg) => {
    setSelectedUser(user);
    setTempPassword(null);
    setIsResetPasswordOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setCreateStep('details');
    setEmailPreview(null);
    setTempPassword(null);
    setFormData({
      email: '',
      fullName: '',
      role: 'client_user',
      organizationId: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage admin and client user accounts
          </p>
        </div>
        <Button onClick={() => {
          setFormData({
            email: '',
            fullName: '',
            role: 'client_user',
            organizationId: '',
          });
          setTempPassword(null);
          setCreateStep('details');
          setEmailPreview(null);
          setIsCreateOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>All Users</CardTitle>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="client_user">Client User</SelectItem>
                </SelectContent>
              </Select>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showArchived ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No users yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first user to get started.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' ? (
                          <Shield className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        {user.fullName || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Admin' : 'Client'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.organization ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {user.organization.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.isActive ? 'success' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Archived'}
                        </Badge>
                        {user.mustChangePassword && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.isActive ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleArchive(user)}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleRestore(user)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restore
                            </DropdownMenuItem>
                          )}
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

      {/* Create Dialog - Multi-step */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {createStep === 'details' ? 'Create User' : 'Preview Welcome Email'}
            </DialogTitle>
            <DialogDescription>
              {createStep === 'details'
                ? 'Add a new user to the system.'
                : 'Review the email that will be sent to the new user.'}
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
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'admin' | 'client_user') => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client_user">Client User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role === 'client_user' && (
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization *</Label>
                  <Select
                    value={formData.organizationId}
                    onValueChange={(value) => setFormData({ ...formData, organizationId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                    <div className="p-4 bg-white max-h-[250px] overflow-y-auto">
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details. Email cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'client_user') => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="client_user">Client User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.role === 'client_user' && (
              <div className="space-y-2">
                <Label htmlFor="edit-organization">Organization *</Label>
                <Select
                  value={formData.organizationId}
                  onValueChange={(value) => setFormData({ ...formData, organizationId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={(open) => {
        if (!open) {
          setIsResetPasswordOpen(false);
          setSelectedUser(null);
          setTempPassword(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset the password for {selectedUser?.email}. The user will be required to change their password on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {tempPassword ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  New Temporary Password (copy now - won&apos;t be shown again):
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-sm">
                    {tempPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast.success('Password copied to clipboard');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose whether to send the new password via email or display it here.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsResetPasswordOpen(false);
              setSelectedUser(null);
              setTempPassword(null);
            }}>
              {tempPassword ? 'Close' : 'Cancel'}
            </Button>
            {!tempPassword && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => handleResetPassword(false)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Show Password
                </Button>
                <Button onClick={() => handleResetPassword(true)} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Send via Email
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

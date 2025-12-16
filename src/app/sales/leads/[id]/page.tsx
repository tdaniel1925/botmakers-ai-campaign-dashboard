'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  DollarSign,
  Calendar,
  Clock,
  Edit,
  MessageSquare,
  Plus,
  Send,
  PhoneCall,
  Users,
  Target,
  History,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime, formatCurrency, formatPhoneNumber } from '@/lib/utils';

interface LeadStage {
  id: string;
  name: string;
  color: string;
}

interface Activity {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  createdAt: string;
  userType: string;
}

interface Enrollment {
  id: string;
  isActive: boolean;
  enrolledAt: string;
  campaign: {
    id: string;
    name: string;
  };
}

interface Lead {
  id: string;
  leadNumber: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  estimatedValue: number | null;
  source: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  stage: LeadStage | null;
  activities: Activity[];
  nurtureEnrollments: Enrollment[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LeadDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    estimatedValue: '',
    source: '',
    notes: '',
    nextFollowUpAt: '',
  });

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const response = await fetch(`/api/sales/leads/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Lead not found');
          router.push('/sales/leads');
          return;
        }
        throw new Error('Failed to fetch lead');
      }
      const data = await response.json();
      setLead(data);
      setEditForm({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || '',
        phone: data.phone || '',
        company: data.company || '',
        jobTitle: data.jobTitle || '',
        estimatedValue: data.estimatedValue ? (data.estimatedValue / 100).toString() : '',
        source: data.source || '',
        notes: data.notes || '',
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt).toISOString().slice(0, 16) : '',
      });
    } catch (error) {
      toast.error('Failed to load lead');
      router.push('/sales/leads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/sales/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          estimatedValue: editForm.estimatedValue
            ? Math.round(parseFloat(editForm.estimatedValue) * 100)
            : null,
          nextFollowUpAt: editForm.nextFollowUpAt || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update lead');

      const updatedLead = await response.json();
      setLead({ ...lead, ...updatedLead } as Lead);
      setIsEditing(false);
      toast.success('Lead updated successfully');
    } catch (error) {
      toast.error('Failed to update lead');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/sales/leads/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: 'note',
          title: 'Note added',
          description: newNote,
        }),
      });

      if (!response.ok) throw new Error('Failed to add note');

      setNewNote('');
      setIsAddingNote(false);
      fetchLead(); // Refresh to get new activity
      toast.success('Note added');
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setIsSaving(false);
    }
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      note: <MessageSquare className="h-4 w-4" />,
      call: <PhoneCall className="h-4 w-4" />,
      email: <Mail className="h-4 w-4" />,
      meeting: <Users className="h-4 w-4" />,
      stage_change: <Target className="h-4 w-4" />,
      status_change: <Target className="h-4 w-4" />,
      enrollment: <Send className="h-4 w-4" />,
    };
    return icons[type] || <History className="h-4 w-4" />;
  };

  const generateLeadId = (leadNumber: number): string => {
    return `LEAD-${String(leadNumber).padStart(4, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales/leads">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">
                {lead.firstName} {lead.lastName}
              </h1>
              <Badge variant="outline" className="font-mono">
                {generateLeadId(lead.leadNumber)}
              </Badge>
              {lead.stage && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: lead.stage.color,
                    color: lead.stage.color,
                  }}
                >
                  {lead.stage.name}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {lead.company || 'No company'} {lead.jobTitle && `• ${lead.jobTitle}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Lead
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input
                      value={editForm.jobTitle}
                      onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{lead.email || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">
                        {lead.phone ? formatPhoneNumber(lead.phone) : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Company</p>
                      <p className="font-medium">{lead.company || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Job Title</p>
                      <p className="font-medium">{lead.jobTitle || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Activity Timeline
                </CardTitle>
                <Button size="sm" onClick={() => setIsAddingNote(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lead.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lead.activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {getActivityIcon(activity.activityType)}
                        </div>
                        {index < lead.activities.length - 1 && (
                          <div className="w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{activity.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(activity.createdAt)}
                          </p>
                        </div>
                        {activity.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {activity.description}
                          </p>
                        )}
                        <Badge variant="outline" className="mt-2 text-xs">
                          {activity.userType === 'sales' ? 'You' : 'Admin'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Deal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Estimated Value ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.estimatedValue}
                      onChange={(e) => setEditForm({ ...editForm, estimatedValue: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Next Follow-up</Label>
                    <Input
                      type="datetime-local"
                      value={editForm.nextFollowUpAt}
                      onChange={(e) => setEditForm({ ...editForm, nextFollowUpAt: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Value</p>
                    <p className="text-2xl font-bold">
                      {lead.estimatedValue
                        ? formatCurrency(lead.estimatedValue / 100)
                        : '-'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Lead Source</p>
                    <p className="font-medium capitalize">
                      {lead.source?.replace('_', ' ') || '-'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Next Follow-up</p>
                    <p className="font-medium">
                      {lead.nextFollowUpAt
                        ? formatDateTime(lead.nextFollowUpAt)
                        : 'Not scheduled'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDateTime(lead.createdAt)}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={6}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {lead.notes || 'No notes yet'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Campaign Enrollments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Campaigns
                </CardTitle>
                <Link href={`/sales/campaigns?leadId=${id}`}>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Enroll
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {lead.nurtureEnrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Not enrolled in any campaigns
                </p>
              ) : (
                <div className="space-y-2">
                  {lead.nurtureEnrollments.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <span className="font-medium">{enrollment.campaign.name}</span>
                      <Badge variant={enrollment.isActive ? 'default' : 'secondary'}>
                        {enrollment.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note about your interaction with this lead
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter your note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingNote(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={isSaving || !newNote.trim()}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

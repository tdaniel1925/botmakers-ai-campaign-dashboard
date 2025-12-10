"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
} from "lucide-react";

interface Schedule {
  id: string;
  campaign_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "UTC", label: "UTC" },
];

// Generate time options (every 30 minutes)
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, "0");
    const minute = m.toString().padStart(2, "0");
    TIME_OPTIONS.push(`${hour}:${minute}:00`);
  }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function CampaignSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // New schedule form
  const [newSchedule, setNewSchedule] = useState({
    days_of_week: [1, 2, 3, 4, 5], // Mon-Fri default
    start_time: "09:00:00",
    end_time: "17:00:00",
    timezone: "America/New_York",
  });

  const { toast } = useToast();

  const fetchSchedules = async () => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/schedule`);
      if (!response.ok) throw new Error("Failed to fetch schedules");
      const data = await response.json();
      setSchedules(data.schedules || []);
      setCampaign(data.campaign);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [id]);

  const handleAddSchedule = async () => {
    if (newSchedule.days_of_week.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one day",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSchedule),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create schedule");
      }

      toast({ title: "Success", description: "Schedule added successfully" });
      setShowAddForm(false);
      setNewSchedule({
        days_of_week: [1, 2, 3, 4, 5],
        start_time: "09:00:00",
        end_time: "17:00:00",
        timezone: "America/New_York",
      });
      fetchSchedules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add schedule",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;

    if (editingSchedule.days_of_week.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one day",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: editingSchedule.id,
          days_of_week: editingSchedule.days_of_week,
          start_time: editingSchedule.start_time,
          end_time: editingSchedule.end_time,
          timezone: editingSchedule.timezone,
          is_active: editingSchedule.is_active,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update schedule");
      }

      toast({ title: "Success", description: "Schedule updated successfully" });
      setEditingSchedule(null);
      fetchSchedules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update schedule",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const response = await fetch(
        `/api/admin/outbound-campaigns/${id}/schedule?schedule_id=${scheduleId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete schedule");
      }

      toast({ title: "Success", description: "Schedule deleted successfully" });
      fetchSchedules();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete schedule",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (schedule: Schedule) => {
    try {
      const response = await fetch(`/api/admin/outbound-campaigns/${id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: schedule.id,
          is_active: !schedule.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update schedule");
      }

      fetchSchedules();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update schedule",
        variant: "destructive",
      });
    }
  };

  const toggleDay = (
    days: number[],
    day: number,
    setDays: (days: number[]) => void
  ) => {
    if (days.includes(day)) {
      setDays(days.filter((d) => d !== day));
    } else {
      setDays([...days, day].sort());
    }
  };

  const isDraft = campaign?.status === "draft";

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
          <h1 className="text-2xl font-bold tracking-tight">Campaign Schedule</h1>
          <p className="text-muted-foreground">
            {campaign?.name} - Configure when calls are made
          </p>
        </div>
      </div>

      {!isDraft && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Schedules can only be modified for draft campaigns
          </p>
        </div>
      )}

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Call Schedules
          </CardTitle>
          <CardDescription>
            Define when the campaign should make calls. Multiple schedules can be combined.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules.length > 0 ? (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`border rounded-lg p-4 ${
                    !schedule.is_active ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  {editingSchedule?.id === schedule.id ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Days of Week</Label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <Button
                              key={day.value}
                              type="button"
                              variant={
                                editingSchedule.days_of_week.includes(day.value)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                setEditingSchedule({
                                  ...editingSchedule,
                                  days_of_week: editingSchedule.days_of_week.includes(day.value)
                                    ? editingSchedule.days_of_week.filter((d) => d !== day.value)
                                    : [...editingSchedule.days_of_week, day.value].sort(),
                                })
                              }
                            >
                              {day.short}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Select
                            value={editingSchedule.start_time}
                            onValueChange={(value) =>
                              setEditingSchedule({ ...editingSchedule, start_time: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {formatTime(time)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Select
                            value={editingSchedule.end_time}
                            onValueChange={(value) =>
                              setEditingSchedule({ ...editingSchedule, end_time: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {formatTime(time)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Timezone</Label>
                          <Select
                            value={editingSchedule.timezone}
                            onValueChange={(value) =>
                              setEditingSchedule({ ...editingSchedule, timezone: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateSchedule} disabled={isSaving}>
                          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSchedule(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </span>
                          <Badge variant={schedule.is_active ? "success" : "secondary"}>
                            {schedule.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {schedule.days_of_week.map((day) => (
                            <Badge key={day} variant="outline">
                              {DAYS_OF_WEEK.find((d) => d.value === day)?.short}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {TIMEZONES.find((tz) => tz.value === schedule.timezone)?.label ||
                            schedule.timezone}
                        </p>
                      </div>
                      {isDraft && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.is_active}
                            onCheckedChange={() => handleToggleActive(schedule)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingSchedule(schedule)}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this schedule. This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No schedules configured</p>
              <p className="text-sm">Add a schedule to define when calls are made</p>
            </div>
          )}

          {/* Add Schedule Form */}
          {isDraft && showAddForm ? (
            <Card className="border-dashed">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">New Schedule</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewSchedule({
                        days_of_week: [1, 2, 3, 4, 5],
                        start_time: "09:00:00",
                        end_time: "17:00:00",
                        timezone: "America/New_York",
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={
                          newSchedule.days_of_week.includes(day.value) ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          toggleDay(newSchedule.days_of_week, day.value, (days) =>
                            setNewSchedule({ ...newSchedule, days_of_week: days })
                          )
                        }
                      >
                        {day.short}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select
                      value={newSchedule.start_time}
                      onValueChange={(value) =>
                        setNewSchedule({ ...newSchedule, start_time: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select
                      value={newSchedule.end_time}
                      onValueChange={(value) =>
                        setNewSchedule({ ...newSchedule, end_time: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={newSchedule.timezone}
                      onValueChange={(value) =>
                        setNewSchedule({ ...newSchedule, timezone: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleAddSchedule} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Plus className="mr-2 h-4 w-4" />
                  Add Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            isDraft && (
              <Button variant="outline" onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Schedule
              </Button>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

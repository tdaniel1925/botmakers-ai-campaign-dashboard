'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Calendar,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ClientReportsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState('7days');
  const [format, setFormat] = useState('csv');

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case '7days':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      const response = await fetch(`/api/reports/export?startDate=${startDate.toISOString()}&format=${format}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interactions-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Export interaction data and generate reports
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Export Interactions
            </CardTitle>
            <CardDescription>
              Download your interaction data as a spreadsheet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel compatible)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Reports
            </CardTitle>
            <CardDescription>
              Set up automatic report delivery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Scheduled reports can be configured by your administrator.
                Contact your admin to set up weekly or monthly report delivery.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What's Included in Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border p-4">
              <h4 className="font-medium mb-2">Interaction Details</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Date and time</li>
                <li>Phone number</li>
                <li>Call status</li>
                <li>Duration</li>
              </ul>
            </div>
            <div className="rounded-md border p-4">
              <h4 className="font-medium mb-2">AI Analysis</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Call summary</li>
                <li>Extracted data</li>
                <li>Detected intents</li>
                <li>Key information</li>
              </ul>
            </div>
            <div className="rounded-md border p-4">
              <h4 className="font-medium mb-2">Campaign Info</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Campaign name</li>
                <li>Source type</li>
                <li>SMS messages sent</li>
                <li>Tags and flags</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

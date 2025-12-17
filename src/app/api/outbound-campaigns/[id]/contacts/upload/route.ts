import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outboundCampaigns, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  parseCSV,
  parseExcel,
  processContacts,
  suggestFieldMappings,
  FieldMapping,
} from '@/services/contact-upload-service';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// POST - Parse uploaded file and return preview
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify admin
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!dbUser || dbUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get campaign
    const [campaign] = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow uploading to draft campaigns
    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only upload contacts to draft campaigns' },
        { status: 400 }
      );
    }

    const contentType = req.headers.get('content-type') || '';

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const mappingJson = formData.get('mapping') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'File is required' }, { status: 400 });
      }

      const fileName = file.name.toLowerCase();
      let headers: string[];
      let rows: Record<string, string>[];

      // Parse based on file type
      if (fileName.endsWith('.csv')) {
        const content = await file.text();
        const parsed = parseCSV(content);
        headers = parsed.headers;
        rows = parsed.rows;
      } else if (
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls')
      ) {
        const buffer = await file.arrayBuffer();
        const parsed = parseExcel(buffer);
        headers = parsed.headers;
        rows = parsed.rows;
      } else {
        return NextResponse.json(
          { error: 'Unsupported file format. Please use CSV or Excel files.' },
          { status: 400 }
        );
      }

      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'File contains no data rows' },
          { status: 400 }
        );
      }

      // If no mapping provided, suggest one
      if (!mappingJson) {
        const suggestedMapping = suggestFieldMappings(headers);

        return NextResponse.json({
          step: 'mapping',
          headers,
          rowCount: rows.length,
          suggestedMapping,
          sampleRows: rows.slice(0, 5), // Return first 5 rows for preview
        });
      }

      // Parse and validate mapping
      let mapping: FieldMapping;
      try {
        mapping = JSON.parse(mappingJson);
      } catch {
        return NextResponse.json(
          { error: 'Invalid mapping JSON' },
          { status: 400 }
        );
      }

      if (!mapping.phoneNumber || !mapping.firstName) {
        return NextResponse.json(
          { error: 'Phone number and first name mappings are required' },
          { status: 400 }
        );
      }

      // Process contacts
      const result = processContacts(rows, mapping, headers);

      return NextResponse.json({
        step: 'preview',
        totalRows: result.totalRows,
        validContacts: result.validContacts.length,
        invalidContacts: result.invalidContacts.length,
        duplicates: result.duplicates.length,
        validPreview: result.validContacts.slice(0, 10),
        invalidPreview: result.invalidContacts.slice(0, 10),
        duplicatePreview: result.duplicates.slice(0, 10),
        contacts: result.validContacts, // Full list for import
      });
    }

    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}

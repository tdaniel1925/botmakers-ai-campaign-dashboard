import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { interactions, campaigns, smsLogs } from '@/db/schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { requireFullAuth } from '@/lib/auth';
import { formatDateTime, formatDuration, formatPhoneNumber } from '@/lib/utils';

// Escape CSV cell to prevent formula injection
// Excel/Sheets interpret cells starting with =, +, -, @, tab, CR as formulas
function escapeCsvCell(value: string): string {
  if (!value) return '';
  // Escape quotes by doubling them
  let escaped = value.replace(/"/g, '""');
  // If cell starts with formula characters, prefix with single quote
  if (/^[=+\-@\t\r]/.test(escaped)) {
    escaped = "'" + escaped;
  }
  return escaped;
}

// GET /api/reports/export - Export interactions as CSV
export async function GET(request: NextRequest) {
  try {
    const user = await requireFullAuth();
    const searchParams = request.nextUrl.searchParams;

    // Filters
    const organizationId = searchParams.get('organizationId');
    const campaignId = searchParams.get('campaignId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';

    // Build date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get allowed campaign IDs based on user role
    let allowedCampaignIds: string[] = [];

    if (user.role === 'client_user') {
      if (!user.organizationId) {
        return NextResponse.json({ error: 'No organization assigned' }, { status: 400 });
      }
      const orgCampaigns = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, user.organizationId));
      allowedCampaignIds = orgCampaigns.map(c => c.id);
    } else if (organizationId) {
      const orgCampaigns = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, organizationId));
      allowedCampaignIds = orgCampaigns.map(c => c.id);
    }

    // Build conditions
    const conditions = [
      gte(interactions.createdAt, start),
      lte(interactions.createdAt, end),
    ];

    if (allowedCampaignIds.length > 0) {
      conditions.push(inArray(interactions.campaignId, allowedCampaignIds));
    }

    if (campaignId) {
      if (user.role === 'client_user' && !allowedCampaignIds.includes(campaignId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      conditions.push(eq(interactions.campaignId, campaignId));
    }

    // Fetch interactions with campaign data
    const data = await db.query.interactions.findMany({
      where: and(...conditions),
      with: {
        campaign: {
          with: {
            organization: true,
          },
        },
      },
      orderBy: [desc(interactions.createdAt)],
      limit: 10000, // Max 10k records for export
    });

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'ID',
        'Date',
        'Organization',
        'Campaign',
        'Source',
        'Platform',
        'Phone Number',
        'Status',
        'Duration (seconds)',
        'AI Summary',
        'Flagged',
        'Tags',
      ];

      const rows = data.map((interaction) => [
        escapeCsvCell(interaction.id),
        escapeCsvCell(formatDateTime(interaction.createdAt)),
        escapeCsvCell(interaction.campaign.organization?.name || ''),
        escapeCsvCell(interaction.campaign.name),
        escapeCsvCell(interaction.sourceType),
        escapeCsvCell(interaction.sourcePlatform || ''),
        escapeCsvCell(interaction.phoneNumber || ''),
        escapeCsvCell(interaction.callStatus || 'pending'),
        escapeCsvCell(interaction.durationSeconds?.toString() || ''),
        escapeCsvCell(interaction.aiSummary || ''),
        escapeCsvCell(interaction.flagged ? 'Yes' : 'No'),
        escapeCsvCell(interaction.tags?.join(', ') || ''),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const filename = `interactions_export_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === 'json') {
      const filename = `interactions_export_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.json`;

      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('[Export API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export data' },
      { status: 500 }
    );
  }
}

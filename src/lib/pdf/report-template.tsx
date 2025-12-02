import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 15,
    marginRight: 10,
    borderRadius: 4,
  },
  statBoxLast: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 15,
    borderRadius: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e293b",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 3,
    textTransform: "uppercase",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontWeight: "bold",
    fontSize: 10,
    color: "#475569",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    color: "#334155",
  },
  sentimentBar: {
    marginTop: 5,
    marginBottom: 10,
  },
  sentimentBarContainer: {
    height: 12,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    flexDirection: "row",
    overflow: "hidden",
  },
  sentimentPositive: {
    backgroundColor: "#22c55e",
    height: 12,
  },
  sentimentNeutral: {
    backgroundColor: "#94a3b8",
    height: 12,
  },
  sentimentNegative: {
    backgroundColor: "#ef4444",
    height: 12,
  },
  sentimentLegend: {
    flexDirection: "row",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 9,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#94a3b8",
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    right: 40,
    fontSize: 9,
    color: "#94a3b8",
  },
});

// Type definitions
interface ReportData {
  clientName: string;
  companyName?: string;
  reportPeriod: string;
  generatedAt: string;
  stats: {
    totalCalls: number;
    avgDuration: string;
    positiveRate: number;
    totalCampaigns: number;
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  campaigns: Array<{
    name: string;
    calls: number;
    avgDuration: string;
    positiveRate: number;
  }>;
  topOutcomes: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

// PDF Document Component
export const CampaignReportPDF: React.FC<{ data: ReportData }> = ({ data }) => {
  const total = data.sentiment.positive + data.sentiment.neutral + data.sentiment.negative;
  const positiveWidth = total > 0 ? (data.sentiment.positive / total) * 100 : 0;
  const neutralWidth = total > 0 ? (data.sentiment.neutral / total) * 100 : 0;
  const negativeWidth = total > 0 ? (data.sentiment.negative / total) * 100 : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Campaign Report</Text>
          <Text style={styles.subtitle}>
            {data.clientName}{data.companyName ? ` - ${data.companyName}` : ""}
          </Text>
          <Text style={{ fontSize: 10, color: "#94a3b8" }}>
            Report Period: {data.reportPeriod} | Generated: {data.generatedAt}
          </Text>
        </View>

        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalCalls}</Text>
              <Text style={styles.statLabel}>Total Calls</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.avgDuration}</Text>
              <Text style={styles.statLabel}>Avg Duration</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={{ ...styles.statValue, color: "#22c55e" }}>
                {data.stats.positiveRate}%
              </Text>
              <Text style={styles.statLabel}>Positive Rate</Text>
            </View>
            <View style={styles.statBoxLast}>
              <Text style={styles.statValue}>{data.stats.totalCampaigns}</Text>
              <Text style={styles.statLabel}>Campaigns</Text>
            </View>
          </View>
        </View>

        {/* Sentiment Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sentiment Analysis</Text>
          <View style={styles.sentimentBar}>
            <View style={styles.sentimentBarContainer}>
              <View style={{ ...styles.sentimentPositive, width: `${positiveWidth}%` }} />
              <View style={{ ...styles.sentimentNeutral, width: `${neutralWidth}%` }} />
              <View style={{ ...styles.sentimentNegative, width: `${negativeWidth}%` }} />
            </View>
            <View style={styles.sentimentLegend}>
              <View style={styles.legendItem}>
                <View style={{ ...styles.legendDot, backgroundColor: "#22c55e" }} />
                <Text style={styles.legendText}>
                  Positive ({data.sentiment.positive})
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={{ ...styles.legendDot, backgroundColor: "#94a3b8" }} />
                <Text style={styles.legendText}>
                  Neutral ({data.sentiment.neutral})
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={{ ...styles.legendDot, backgroundColor: "#ef4444" }} />
                <Text style={styles.legendText}>
                  Negative ({data.sentiment.negative})
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Campaign Breakdown */}
        {data.campaigns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Campaign Performance</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Campaign</Text>
                <Text style={styles.tableHeaderCell}>Calls</Text>
                <Text style={styles.tableHeaderCell}>Avg Duration</Text>
                <Text style={styles.tableHeaderCell}>Positive Rate</Text>
              </View>
              {data.campaigns.map((campaign, index) => (
                <View style={styles.tableRow} key={index}>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{campaign.name}</Text>
                  <Text style={styles.tableCell}>{campaign.calls}</Text>
                  <Text style={styles.tableCell}>{campaign.avgDuration}</Text>
                  <Text style={styles.tableCell}>{campaign.positiveRate}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Outcomes */}
        {data.topOutcomes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Outcomes</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Outcome</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>Percentage</Text>
              </View>
              {data.topOutcomes.slice(0, 5).map((outcome, index) => (
                <View style={styles.tableRow} key={index}>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{outcome.name}</Text>
                  <Text style={styles.tableCell}>{outcome.count}</Text>
                  <Text style={styles.tableCell}>{outcome.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by BotMakers Call Analytics Platform
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

export default CampaignReportPDF;

// Helper to create the PDF element for renderToBuffer
export function createReportPDF(data: ReportData) {
  return <CampaignReportPDF data={data} />;
}

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";

export interface CampaignStats {
  name: string;
  totalCalls: number;
  completedCalls: number;
  avgSentiment: string;
  topOutcome: string;
  positiveRate: number;
}

export interface CampaignReportEmailProps {
  recipientName: string;
  reportPeriod: string; // e.g., "December 1-7, 2024"
  campaigns: CampaignStats[];
  totalCalls: number;
  totalCampaigns: number;
  overallPositiveRate: number;
  dashboardUrl: string;
  logoUrl?: string;
  primaryColor?: string;
  companyName?: string;
}

export const CampaignReportEmail: React.FC<CampaignReportEmailProps> = ({
  recipientName,
  reportPeriod,
  campaigns,
  totalCalls,
  totalCampaigns,
  overallPositiveRate,
  dashboardUrl,
  logoUrl,
  primaryColor = "#10B981",
  companyName = "BotMakers",
}) => {
  const previewText = `Your ${companyName} Campaign Report for ${reportPeriod}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={`${companyName} Logo`} style={logo} />
            ) : (
              <Text style={{ ...logoText, color: primaryColor }}>
                {companyName}
              </Text>
            )}
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={{ ...headingStyle, color: primaryColor }}>
              Campaign Report
            </Heading>

            <Text style={reportPeriodText}>{reportPeriod}</Text>

            <Text style={paragraph}>Hi {recipientName},</Text>

            <Text style={paragraph}>
              Here&apos;s your campaign performance summary for the past period.
              Your calls have been analyzed by our AI to give you actionable
              insights.
            </Text>

            {/* Summary Stats */}
            <Section style={statsContainer}>
              <Row>
                <Column style={statBox}>
                  <Text style={statNumber}>{totalCalls}</Text>
                  <Text style={statLabel}>Total Calls</Text>
                </Column>
                <Column style={statBox}>
                  <Text style={statNumber}>{totalCampaigns}</Text>
                  <Text style={statLabel}>Active Campaigns</Text>
                </Column>
                <Column style={statBox}>
                  <Text style={{ ...statNumber, color: primaryColor }}>
                    {overallPositiveRate}%
                  </Text>
                  <Text style={statLabel}>Positive Rate</Text>
                </Column>
              </Row>
            </Section>

            {/* Campaign Breakdown */}
            {campaigns.length > 0 && (
              <>
                <Text style={sectionTitle}>Campaign Breakdown</Text>
                {campaigns.map((campaign, index) => (
                  <Section key={index} style={campaignCard}>
                    <Text style={campaignName}>{campaign.name}</Text>
                    <table style={campaignStatsTable}>
                      <tbody>
                        <tr>
                          <td style={campaignStatLabel}>Calls:</td>
                          <td style={campaignStatValue}>
                            {campaign.totalCalls} ({campaign.completedCalls}{" "}
                            analyzed)
                          </td>
                        </tr>
                        <tr>
                          <td style={campaignStatLabel}>Avg Sentiment:</td>
                          <td style={campaignStatValue}>
                            <span
                              style={{
                                ...sentimentBadge,
                                backgroundColor:
                                  campaign.avgSentiment === "positive"
                                    ? "#dcfce7"
                                    : campaign.avgSentiment === "negative"
                                    ? "#fee2e2"
                                    : "#f3f4f6",
                                color:
                                  campaign.avgSentiment === "positive"
                                    ? "#166534"
                                    : campaign.avgSentiment === "negative"
                                    ? "#991b1b"
                                    : "#374151",
                              }}
                            >
                              {campaign.avgSentiment}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style={campaignStatLabel}>Top Outcome:</td>
                          <td style={campaignStatValue}>{campaign.topOutcome}</td>
                        </tr>
                        <tr>
                          <td style={campaignStatLabel}>Positive Rate:</td>
                          <td style={campaignStatValue}>
                            {campaign.positiveRate}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Section>
                ))}
              </>
            )}

            {/* CTA Button */}
            <Section style={buttonSection}>
              <Button
                style={{ ...button, backgroundColor: primaryColor }}
                href={dashboardUrl}
              >
                View Full Dashboard
              </Button>
            </Section>

            <Text style={paragraph}>
              For detailed analytics and call transcripts, visit your dashboard.
            </Text>

            <Text style={paragraph}>
              Best regards,
              <br />
              The {companyName} Team
            </Text>
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footerSection}>
            <Text style={footerTextStyle}>
              This report was automatically generated by {companyName} Call
              Analytics.
            </Text>
            <Text style={footerTextStyle}>
              <Link href={dashboardUrl} style={footerLink}>
                Dashboard
              </Link>
              {" | "}
              <Link href="#" style={footerLink}>
                Manage Email Preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
};

const headerSection = {
  padding: "32px 48px 24px",
  textAlign: "center" as const,
};

const logo = {
  maxHeight: "48px",
  maxWidth: "200px",
  objectFit: "contain" as const,
};

const logoText = {
  fontSize: "28px",
  fontWeight: "700",
  margin: "0",
};

const contentSection = {
  padding: "0 48px",
};

const headingStyle = {
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 8px",
};

const reportPeriodText = {
  color: "#64748b",
  fontSize: "14px",
  margin: "0 0 24px",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

const statsContainer = {
  margin: "32px 0",
};

const statBox = {
  textAlign: "center" as const,
  padding: "16px",
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
};

const statNumber = {
  fontSize: "32px",
  fontWeight: "700",
  color: "#1a202c",
  margin: "0",
};

const statLabel = {
  fontSize: "12px",
  color: "#64748b",
  margin: "4px 0 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

const sectionTitle = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a202c",
  margin: "32px 0 16px",
  borderBottom: "2px solid #e2e8f0",
  paddingBottom: "8px",
};

const campaignCard = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  padding: "16px",
  margin: "12px 0",
};

const campaignName = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1a202c",
  margin: "0 0 12px",
};

const campaignStatsTable = {
  width: "100%",
};

const campaignStatLabel = {
  color: "#64748b",
  fontSize: "13px",
  padding: "4px 0",
  width: "40%",
};

const campaignStatValue = {
  color: "#1a202c",
  fontSize: "13px",
  padding: "4px 0",
};

const sentimentBadge = {
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: "500",
  textTransform: "capitalize" as const,
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "42px 0 26px",
};

const footerSection = {
  padding: "0 48px",
};

const footerTextStyle = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "8px 0",
  textAlign: "center" as const,
};

const footerLink = {
  color: "#8898aa",
  textDecoration: "underline",
};

export default CampaignReportEmail;

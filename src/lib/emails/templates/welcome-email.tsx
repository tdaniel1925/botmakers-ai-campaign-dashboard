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
} from "@react-email/components";
import * as React from "react";

export interface WelcomeEmailProps {
  recipientName: string;
  recipientEmail?: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
  logoUrl?: string;
  primaryColor?: string;
  companyName?: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({
  recipientName,
  username,
  tempPassword,
  loginUrl,
  logoUrl,
  primaryColor = "#10B981",
  companyName = "BotMakers",
}) => {
  const previewText = `Welcome to ${companyName} Call Analytics - Your login credentials inside`;

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
              Welcome to {companyName}!
            </Heading>

            <Text style={paragraph}>Hi {recipientName},</Text>

            <Text style={paragraph}>
              Your account has been created for the {companyName} Call Analytics
              platform. You can now access powerful insights into your call
              campaigns, including AI-powered summaries, sentiment analysis, and
              outcome tracking.
            </Text>

            {/* Credentials Box */}
            <Section style={credentialsBox}>
              <Text style={credentialsTitle}>Your Login Credentials</Text>
              <table style={credentialsTable}>
                <tbody>
                  <tr>
                    <td style={credentialsLabel}>Username:</td>
                    <td style={credentialsValue}>
                      <code style={codeStyle}>{username}</code>
                    </td>
                  </tr>
                  <tr>
                    <td style={credentialsLabel}>Temporary Password:</td>
                    <td style={credentialsValue}>
                      <code style={codeStyle}>{tempPassword}</code>
                    </td>
                  </tr>
                </tbody>
              </table>
              <Text style={credentialsNote}>
                You will be asked to change your password on first login.
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={buttonSection}>
              <Button style={{ ...button, backgroundColor: primaryColor }} href={loginUrl}>
                Sign In to Your Account
              </Button>
            </Section>

            <Text style={paragraph}>
              If you have any questions or need assistance, please don&apos;t hesitate
              to reach out to our support team.
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
              This email was sent by {companyName} Call Analytics Platform.
            </Text>
            <Text style={footerTextStyle}>
              <Link href={loginUrl} style={footerLink}>
                Sign in
              </Link>
              {" | "}
              <Link href="#" style={footerLink}>
                Help Center
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
  overflow: "hidden" as const,
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
  margin: "0 0 24px",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
  wordBreak: "break-word" as const,
  overflowWrap: "break-word" as const,
};

const credentialsBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  padding: "24px",
  margin: "24px 0",
};

const credentialsTitle = {
  color: "#1a202c",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 16px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

const credentialsTable = {
  width: "100%",
};

const credentialsLabel = {
  color: "#64748b",
  fontSize: "14px",
  padding: "8px 0",
  width: "45%",
};

const credentialsValue = {
  color: "#1a202c",
  fontSize: "14px",
  padding: "8px 0",
};

const codeStyle = {
  backgroundColor: "#e2e8f0",
  padding: "4px 8px",
  borderRadius: "4px",
  fontFamily: "monospace",
  fontSize: "14px",
  color: "#1a202c",
};

const credentialsNote = {
  color: "#94a3b8",
  fontSize: "12px",
  margin: "16px 0 0",
  fontStyle: "italic",
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

export default WelcomeEmail;

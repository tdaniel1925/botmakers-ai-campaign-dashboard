import {
  Body,
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

export interface BaseTemplateProps {
  previewText: string;
  heading: string;
  logoUrl?: string;
  primaryColor?: string;
  children: React.ReactNode;
  footerText?: string;
}

export const BaseTemplate: React.FC<BaseTemplateProps> = ({
  previewText,
  heading,
  logoUrl,
  primaryColor = "#10B981",
  children,
  footerText = "This email was sent by BotMakers Call Analytics Platform.",
}) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={headerSection}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt="Company Logo"
                style={logo}
              />
            ) : (
              <Text style={{ ...logoText, color: primaryColor }}>
                BotMakers
              </Text>
            )}
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={{ ...headingStyle, color: primaryColor }}>
              {heading}
            </Heading>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footerSection}>
            <Text style={footerTextStyle}>{footerText}</Text>
            <Text style={footerTextStyle}>
              <Link href="{{unsubscribe_url}}" style={footerLink}>
                Manage email preferences
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

export default BaseTemplate;

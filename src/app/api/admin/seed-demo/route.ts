import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Demo data
const demoClients = [
  { name: "John Smith", email: "john.smith@acmecorp.com", company_name: "Acme Corporation", username: "john.smith" },
  { name: "Sarah Johnson", email: "sarah@techstartup.io", company_name: "Tech Startup Inc", username: "sarah.johnson" },
  { name: "Michael Chen", email: "mchen@globalenterprises.com", company_name: "Global Enterprises", username: "michael.chen" },
  { name: "Emily Davis", email: "emily.davis@retailplus.com", company_name: "Retail Plus", username: "emily.davis" },
  { name: "Robert Wilson", email: "rwilson@financegroup.com", company_name: "Finance Group LLC", username: "robert.wilson" },
];

const demoCampaigns = [
  { name: "Q4 Sales Outreach", description: "End of year sales campaign targeting enterprise clients" },
  { name: "Customer Satisfaction Survey", description: "Post-purchase satisfaction follow-up calls" },
  { name: "Product Launch Campaign", description: "New product announcement and demo scheduling" },
  { name: "Renewal Reminders", description: "Subscription renewal outreach campaign" },
  { name: "Lead Qualification", description: "Qualifying inbound leads from marketing campaigns" },
  { name: "Support Follow-up", description: "Following up on resolved support tickets" },
  { name: "Appointment Scheduling", description: "Booking consultation appointments" },
  { name: "Win-back Campaign", description: "Re-engaging churned customers" },
];

const outcomeTagSets = [
  [
    { tag_name: "Interested", tag_color: "#22c55e", is_positive: true },
    { tag_name: "Not Interested", tag_color: "#ef4444", is_positive: false },
    { tag_name: "Callback Requested", tag_color: "#3b82f6", is_positive: true },
    { tag_name: "Voicemail", tag_color: "#6b7280", is_positive: false },
    { tag_name: "Wrong Number", tag_color: "#f59e0b", is_positive: false },
  ],
  [
    { tag_name: "Very Satisfied", tag_color: "#22c55e", is_positive: true },
    { tag_name: "Satisfied", tag_color: "#84cc16", is_positive: true },
    { tag_name: "Neutral", tag_color: "#6b7280", is_positive: false },
    { tag_name: "Dissatisfied", tag_color: "#f97316", is_positive: false },
    { tag_name: "Very Dissatisfied", tag_color: "#ef4444", is_positive: false },
  ],
  [
    { tag_name: "Demo Scheduled", tag_color: "#22c55e", is_positive: true },
    { tag_name: "Sent Info", tag_color: "#3b82f6", is_positive: true },
    { tag_name: "Not a Fit", tag_color: "#ef4444", is_positive: false },
    { tag_name: "Follow Up Later", tag_color: "#f59e0b", is_positive: true },
    { tag_name: "No Answer", tag_color: "#6b7280", is_positive: false },
  ],
];

const sampleTranscripts = [
  `Agent: Good morning, this is Alex from Acme Corporation. Am I speaking with the decision maker regarding your company's software needs?
Customer: Yes, that's me. What can I do for you?
Agent: I'm reaching out because we've helped companies similar to yours reduce their operational costs by up to 30%. Would you be interested in a quick demo?
Customer: Actually, yes. We've been looking at solutions like this. Can you tell me more about pricing?
Agent: Absolutely! Our pricing is based on usage and typically ranges from $500 to $2000 per month depending on your needs. Would next Tuesday work for a demo?
Customer: Tuesday works. Let's do 2pm.
Agent: Perfect! I'll send you a calendar invite. Thank you for your time!`,

  `Agent: Hi, this is calling from Tech Support. We're following up on your recent ticket.
Customer: Oh yes, thanks for calling back.
Agent: I wanted to make sure your issue was fully resolved. Are you still experiencing any problems with the software?
Customer: No, everything is working great now. Your team did a fantastic job.
Agent: That's wonderful to hear! On a scale of 1-10, how would you rate your support experience?
Customer: I'd give it a 9. Very impressed with the quick response time.
Agent: Thank you so much for the feedback! Is there anything else I can help you with today?
Customer: No, that's all. Thanks again!`,

  `Agent: Hello, may I speak with the business owner please?
Customer: Speaking. What's this about?
Agent: I'm calling about our new inventory management system. It could really help streamline your operations.
Customer: I appreciate the call, but we just signed a 2-year contract with another vendor last month.
Agent: I understand completely. Would it be okay if I reached out in about 18 months when your contract is up for renewal?
Customer: Sure, that would be fine.
Agent: Great, I'll make a note. Have a wonderful day!`,

  `Agent: Good afternoon! This is calling regarding your account renewal coming up next month.
Customer: Oh right, I've been meaning to look into that.
Agent: I wanted to let you know we have some special renewal rates available. Would you like to hear about them?
Customer: Yes, definitely. What are the options?
Agent: For annual renewals, we're offering 15% off plus an extra month free. That brings your total to just $850 for the year.
Customer: That's a good deal. Let me talk to my partner and I'll call back by Friday.
Agent: Sounds great! I'll follow up Friday afternoon if I don't hear from you. Thank you!`,

  `Agent: Hi there, I'm calling from the sales team. We received your inquiry about our enterprise plan.
Customer: Yes, I filled out the form yesterday. We're looking for a solution for about 50 users.
Agent: Perfect! Our enterprise plan would be ideal for your team size. It includes unlimited storage, priority support, and custom integrations.
Customer: What about security? We're in healthcare so HIPAA compliance is essential.
Agent: Absolutely, we're fully HIPAA compliant with SOC 2 Type II certification. We can provide all documentation.
Customer: That's exactly what we need. Can we set up a technical review call with your team?
Agent: Of course! How does Thursday at 10am look?
Customer: Perfect. Looking forward to it.`,
];

const sentiments = ["positive", "negative", "neutral"];

function randomDate(daysBack: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  date.setHours(Math.floor(Math.random() * 10) + 8); // 8am - 6pm
  date.setMinutes(Math.floor(Math.random() * 60));
  return date;
}

function generateCallSummary(sentiment: string): string {
  const summaries = {
    positive: [
      "Customer expressed strong interest in our product. Scheduled a follow-up demo for next week. High likelihood of conversion.",
      "Excellent call - customer was very engaged and asked detailed questions about features. Moving to proposal stage.",
      "Customer is ready to proceed with the trial. Will send onboarding materials today.",
      "Great conversation about their pain points. Our solution directly addresses their needs. Sending pricing proposal.",
      "Customer loved the demo and wants to involve their team in the next call. Very promising opportunity.",
    ],
    negative: [
      "Customer not interested at this time. They recently signed with a competitor. Set reminder to follow up in 6 months.",
      "Budget constraints prevent moving forward this quarter. Will reconnect next fiscal year.",
      "Customer had a negative experience previously and is hesitant to re-engage. Escalated to account manager.",
      "Wrong contact - not the decision maker. Need to identify correct stakeholder.",
      "Customer explicitly requested to be removed from call list. Updated preferences accordingly.",
    ],
    neutral: [
      "Customer is evaluating multiple options. Sent comparison materials for review. Follow up scheduled for next week.",
      "Left voicemail with callback number. Will try again tomorrow morning.",
      "Customer needs to discuss internally before making any decisions. Following up in 2 weeks.",
      "Initial discovery call completed. Customer is in early research phase. Added to nurture campaign.",
      "Customer asked for more information via email. Sent requested materials.",
    ],
  };
  const options = summaries[sentiment as keyof typeof summaries];
  return options[Math.floor(Math.random() * options.length)];
}

function generateKeyPoints(sentiment: string): string[] {
  const keyPoints = {
    positive: [
      "Strong buying signal",
      "Budget approved for Q4",
      "Decision maker engaged",
      "Timeline: 30 days",
      "Requested pricing",
      "Demo scheduled",
      "Competitive evaluation",
      "Multiple stakeholders involved",
    ],
    negative: [
      "No current need",
      "Budget frozen",
      "Competitor selected",
      "Contract locked in",
      "Bad timing",
      "Not decision maker",
      "Requested removal",
      "Previous bad experience",
    ],
    neutral: [
      "Needs more information",
      "Evaluating options",
      "Internal discussion needed",
      "Early research phase",
      "Follow up required",
      "Left voicemail",
      "Requested materials",
      "Timeline unclear",
    ],
  };
  const options = keyPoints[sentiment as keyof typeof keyPoints];
  const count = Math.floor(Math.random() * 3) + 2;
  return options.sort(() => 0.5 - Math.random()).slice(0, count);
}

export async function POST() {
  try {
    // Verify admin access
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const supabase = getSupabaseClient();

    // Create demo clients
    const createdClients: { id: string; name: string }[] = [];
    for (const client of demoClients) {
      const { data, error } = await supabase
        .from("clients")
        .upsert(
          {
            ...client,
            is_active: true,
            invite_status: "accepted",
            report_frequency: ["daily", "weekly", "monthly"][Math.floor(Math.random() * 3)],
          },
          { onConflict: "email" }
        )
        .select("id, name")
        .single();

      if (data) {
        createdClients.push(data);
      }
      if (error) console.error("Client error:", error);
    }

    // Create campaigns for each client
    const createdCampaigns: { id: string; client_id: string }[] = [];
    for (const client of createdClients) {
      // Each client gets 2-4 campaigns
      const numCampaigns = Math.floor(Math.random() * 3) + 2;
      const shuffledCampaigns = [...demoCampaigns].sort(() => 0.5 - Math.random()).slice(0, numCampaigns);

      for (const campaign of shuffledCampaigns) {
        const webhookToken = `demo_${client.id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            client_id: client.id,
            name: campaign.name,
            description: campaign.description,
            webhook_token: webhookToken,
            is_active: true,
          })
          .select("id, client_id")
          .single();

        if (data) {
          createdCampaigns.push(data);

          // Add outcome tags
          const tagSet = outcomeTagSets[Math.floor(Math.random() * outcomeTagSets.length)];
          for (let i = 0; i < tagSet.length; i++) {
            await supabase.from("campaign_outcome_tags").insert({
              campaign_id: data.id,
              ...tagSet[i],
              sort_order: i,
            });
          }
        }
        if (error) console.error("Campaign error:", error);
      }
    }

    // Create calls for each campaign
    let totalCalls = 0;
    for (const campaign of createdCampaigns) {
      // Get outcome tags for this campaign
      const { data: tags } = await supabase
        .from("campaign_outcome_tags")
        .select("id, is_positive")
        .eq("campaign_id", campaign.id);

      if (!tags || tags.length === 0) continue;

      // Each campaign gets 15-40 calls
      const numCalls = Math.floor(Math.random() * 26) + 15;

      for (let i = 0; i < numCalls; i++) {
        const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
        const isPositiveSentiment = sentiment === "positive";

        // Match outcome tag to sentiment
        const matchingTags = tags.filter((t) => t.is_positive === isPositiveSentiment);
        const outcomeTag = matchingTags.length > 0
          ? matchingTags[Math.floor(Math.random() * matchingTags.length)]
          : tags[Math.floor(Math.random() * tags.length)];

        const callDate = randomDate(60); // Last 60 days
        const duration = Math.floor(Math.random() * 480) + 60; // 1-9 minutes

        const phoneNumber = `+1${Math.floor(Math.random() * 900 + 100)}${Math.floor(Math.random() * 900 + 100)}${Math.floor(Math.random() * 9000 + 1000)}`;

        await supabase.from("calls").insert({
          campaign_id: campaign.id,
          transcript: sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)],
          caller_phone: phoneNumber,
          call_duration: duration,
          external_call_id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          ai_summary: generateCallSummary(sentiment),
          ai_outcome_tag_id: outcomeTag.id,
          ai_sentiment: sentiment,
          ai_key_points: generateKeyPoints(sentiment),
          ai_caller_intent: ["Purchase inquiry", "Support request", "Information gathering", "Complaint", "Renewal"][Math.floor(Math.random() * 5)],
          ai_resolution: ["Resolved", "Pending", "Escalated", "Follow-up needed"][Math.floor(Math.random() * 4)],
          ai_processed_at: callDate,
          status: "completed",
          call_timestamp: callDate,
          created_at: callDate,
        });

        totalCalls++;
      }
    }

    // Seed email templates if not exists
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? "http://localhost:2900" : ""}/api/admin/email-templates/seed`, {
      method: "POST",
    }).catch(() => {});

    // Create some email logs
    for (const client of createdClients) {
      const emailTypes = ["welcome", "campaign_report", "re_invite"];
      const statuses = ["sent", "delivered", "sent", "delivered", "delivered"];

      for (let i = 0; i < 3; i++) {
        await supabase.from("email_logs").insert({
          client_id: client.id,
          template_slug: emailTypes[i % emailTypes.length],
          recipient_email: demoClients.find((c) => c.name === client.name)?.email || "demo@example.com",
          recipient_name: client.name,
          subject: `${emailTypes[i % emailTypes.length] === "welcome" ? "Welcome to BotMakers" : emailTypes[i % emailTypes.length] === "campaign_report" ? "Your Weekly Report" : "Your Account is Ready"}`,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          sent_at: randomDate(30),
          created_at: randomDate(30),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Demo data seeded successfully",
      stats: {
        clients: createdClients.length,
        campaigns: createdCampaigns.length,
        calls: totalCalls,
      },
    });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return NextResponse.json(
      { error: "Failed to seed demo data", details: String(error) },
      { status: 500 }
    );
  }
}

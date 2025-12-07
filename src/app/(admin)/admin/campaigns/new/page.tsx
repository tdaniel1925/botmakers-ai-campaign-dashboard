"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, PhoneIncoming, PhoneOutgoing, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NewCampaignTypePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create New Campaign
          </h1>
          <p className="text-muted-foreground">
            Choose the type of campaign you want to create
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        {/* Inbound Campaign Card */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
          onClick={() => router.push("/admin/inbound/new")}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <PhoneIncoming className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-4">Inbound Campaign</CardTitle>
            <CardDescription>
              Receive and process incoming calls with AI-powered analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Webhook endpoint to receive call data
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                AI parses any JSON payload format
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Phone number for receiving calls
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Configure AI agent voice and personality
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Automatic call transcription and analysis
              </li>
            </ul>
            <Button className="w-full mt-6" variant="outline">
              Create Inbound Campaign
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Outbound Campaign Card */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
          onClick={() => router.push("/admin/outbound/new")}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <PhoneOutgoing className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <CardTitle className="mt-4">Outbound Campaign</CardTitle>
            <CardDescription>
              Launch AI-powered calling campaigns to reach your contacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Upload contact lists (CSV)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Configure AI agent voice and script
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Schedule calling windows by timezone
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Provision or import phone numbers
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Real-time campaign analytics
              </li>
            </ul>
            <Button className="w-full mt-6" variant="outline">
              Create Outbound Campaign
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <div className="max-w-4xl">
        <p className="text-sm text-muted-foreground">
          <strong>Not sure which to choose?</strong> Use <em>Inbound</em> if you want to handle incoming customer calls
          with AI assistance. Use <em>Outbound</em> if you want to proactively reach out to contacts with automated AI calls.
        </p>
      </div>
    </div>
  );
}

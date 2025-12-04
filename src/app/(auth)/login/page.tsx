"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/shared/logo";
import Link from "next/link";

// Email regex for validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [rateLimitError, setRateLimitError] = useState("");
  const { toast } = useToast();
  const supabase = createClient();

  const validateEmail = (email: string): boolean => {
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    setIsLoading(true);
    setRateLimitError("");

    try {
      // Use rate-limited API endpoint
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, type: "password" }),
      });

      const data = await response.json();

      if (response.status === 429) {
        // Rate limited
        setRateLimitError(data.message || "Too many login attempts. Please try again later.");
        toast({
          title: "Too many attempts",
          description: data.message || "Please wait before trying again.",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        toast({
          title: "Login failed",
          description: data.error || "Invalid email or password. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Set session in Supabase client
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      window.location.href = "/";
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    setIsLoading(true);
    setRateLimitError("");

    try {
      // Use rate-limited API endpoint
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "otp" }),
      });

      const data = await response.json();

      if (response.status === 429) {
        // Rate limited
        setRateLimitError(data.message || "Too many login attempts. Please try again later.");
        toast({
          title: "Too many attempts",
          description: data.message || "Please wait before trying again.",
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to send magic link",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Check your email",
        description: "We sent you a login link. Check your inbox!",
      });
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Logo maxHeight={48} />
          </div>
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <form onSubmit={isMagicLink ? handleMagicLink : handleEmailLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={() => email && validateEmail(email)}
                className={emailError ? "border-red-500" : ""}
                required
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
              />
              {emailError && (
                <p id="email-error" className="text-sm text-red-500">
                  {emailError}
                </p>
              )}
            </div>
            {!isMagicLink && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {rateLimitError && (
              <div className="w-full p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {rateLimitError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || !!rateLimitError}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isMagicLink ? "Send Magic Link" : "Sign In"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsMagicLink(!isMagicLink)}
            >
              {isMagicLink
                ? "Sign in with password"
                : "Sign in with magic link"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

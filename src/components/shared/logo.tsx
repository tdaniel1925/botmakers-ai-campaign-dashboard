"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";

interface LogoProps {
  className?: string;
  maxHeight?: number;
  fillWidth?: boolean;
}

export function Logo({ className, maxHeight = 48, fillWidth = false }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUrlDark, setLogoUrlDark] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchLogo() {
      const { data } = await supabase
        .from("platform_settings")
        .select("logo_url, logo_url_dark, logo_aspect_ratio")
        .single();

      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
      if (data?.logo_url_dark) {
        setLogoUrlDark(data.logo_url_dark);
      }
    }

    fetchLogo();
  }, [supabase]);

  // Determine which logo to show based on theme
  const currentLogo = mounted && resolvedTheme === "dark" && logoUrlDark
    ? logoUrlDark
    : logoUrl;

  if (!currentLogo) {
    return (
      <div className={`font-bold text-xl text-primary ${className}`}>
        BotMakers
      </div>
    );
  }

  return (
    <div className={className} style={fillWidth ? { width: '100%' } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentLogo}
        alt="Logo"
        style={{
          maxHeight: `${maxHeight}px`,
          height: 'auto',
          width: fillWidth ? '100%' : 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

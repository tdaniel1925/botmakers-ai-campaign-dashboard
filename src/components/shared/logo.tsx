"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LogoProps {
  className?: string;
  maxHeight?: number;
  fillWidth?: boolean;
}

export function Logo({ className, maxHeight = 48, fillWidth = false }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLogo() {
      const { data } = await supabase
        .from("platform_settings")
        .select("logo_url, logo_aspect_ratio")
        .single();

      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    }

    fetchLogo();
  }, [supabase]);

  if (!logoUrl) {
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
        src={logoUrl}
        alt="Logo"
        style={{
          maxHeight: fillWidth ? undefined : `${maxHeight}px`,
          height: fillWidth ? 'auto' : undefined,
          width: fillWidth ? '100%' : 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

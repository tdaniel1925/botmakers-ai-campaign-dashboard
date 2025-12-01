"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LogoProps {
  className?: string;
  maxHeight?: number;
}

export function Logo({ className, maxHeight = 48 }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLogo() {
      const { data } = await supabase
        .from("platform_settings")
        .select("logo_url, logo_aspect_ratio")
        .single();

      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
        setAspectRatio(data.logo_aspect_ratio || 1);
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

  const width = maxHeight * aspectRatio;

  return (
    <div className={className}>
      <Image
        src={logoUrl}
        alt="Logo"
        width={width}
        height={maxHeight}
        style={{
          maxHeight: `${maxHeight}px`,
          width: "auto",
          objectFit: "contain",
        }}
        priority
      />
    </div>
  );
}

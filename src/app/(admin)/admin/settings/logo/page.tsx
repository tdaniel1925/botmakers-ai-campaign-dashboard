"use client";

import { useState, useEffect } from "react";
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
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function LogoSettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PNG, JPG, SVG, or WebP file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get image dimensions
      const img = document.createElement("img");
      const objectUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve) => {
        img.onload = () => {
          const ratio = img.width / img.height;
          setAspectRatio(ratio);
          resolve();
        };
        img.src = objectUrl;
      });

      // Upload to Supabase Storage
      const fileName = `platform-logo-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      const newLogoUrl = urlData.publicUrl;

      // Update platform settings
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .single();

      if (existing) {
        await supabase
          .from("platform_settings")
          .update({
            logo_url: newLogoUrl,
            logo_aspect_ratio: aspectRatio,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("platform_settings").insert({
          logo_url: newLogoUrl,
          logo_aspect_ratio: aspectRatio,
        });
      }

      setLogoUrl(newLogoUrl);

      toast({
        title: "Logo uploaded",
        description: "Your logo has been updated successfully",
      });

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await supabase
        .from("platform_settings")
        .update({
          logo_url: null,
          logo_aspect_ratio: null,
          updated_at: new Date().toISOString(),
        })
        .not("id", "is", null);

      setLogoUrl(null);

      toast({
        title: "Logo removed",
        description: "Your logo has been removed",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "Failed to remove logo",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logo Settings</h1>
        <p className="text-muted-foreground">
          Upload your platform logo to display across the application
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Logo</CardTitle>
            <CardDescription>
              This logo will appear on the login page, sidebar, and client
              dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Platform Logo"
                  width={200}
                  height={80}
                  style={{
                    maxHeight: "80px",
                    width: "auto",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                  <p>No logo uploaded</p>
                </div>
              )}
            </div>
          </CardContent>
          {logoUrl && (
            <CardFooter>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Logo
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload New Logo</CardTitle>
            <CardDescription>
              Supported formats: PNG, JPG, SVG, WebP (max 2MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo">Select File</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleUpload}
                  disabled={isUploading}
                  className="flex-1"
                />
              </div>
            </div>

            {isUploading && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}

            <div className="text-sm text-muted-foreground space-y-1">
              <p>Tips for best results:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a transparent background (PNG or SVG)</li>
                <li>Horizontal logos work best</li>
                <li>Recommended height: 48-100px</li>
                <li>Aspect ratio will be preserved automatically</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

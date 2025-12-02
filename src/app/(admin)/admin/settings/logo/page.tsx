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
import { Loader2, Upload, Trash2, Image as ImageIcon, Sun, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

type LogoType = "light" | "dark";

export default function LogoSettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUrlDark, setLogoUrlDark] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<LogoType | null>(null);
  const [isDeleting, setIsDeleting] = useState<LogoType | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ file: File; type: LogoType } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    async function fetchLogos() {
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

    fetchLogos();
  }, [supabase]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: LogoType) => {
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

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile({ file, type });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const { file, type } = selectedFile;
    setIsUploading(type);

    try {
      // Get image dimensions
      const img = document.createElement("img");
      let calculatedRatio = 1;

      await new Promise<void>((resolve) => {
        img.onload = () => {
          calculatedRatio = img.width / img.height;
          resolve();
        };
        img.src = previewUrl!;
      });

      // Upload via API endpoint (bypasses RLS)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("aspectRatio", calculatedRatio.toString());
      formData.append("logoType", type);

      const response = await fetch("/api/admin/logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      if (type === "light") {
        setLogoUrl(result.logoUrl);
      } else {
        setLogoUrlDark(result.logoUrl);
      }

      toast({
        title: "Logo uploaded",
        description: `Your ${type} mode logo has been updated successfully`,
      });

      // Clear selection
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setSelectedFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(null);
    }
  };

  const handleCancelSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const handleDelete = async (type: LogoType) => {
    setIsDeleting(type);

    try {
      const response = await fetch(`/api/admin/logo?logoType=${type}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Delete failed");
      }

      if (type === "light") {
        setLogoUrl(null);
      } else {
        setLogoUrlDark(null);
      }

      toast({
        title: "Logo removed",
        description: `Your ${type} mode logo has been removed`,
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to remove logo",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const renderLogoCard = (type: LogoType, url: string | null, icon: React.ReactNode, title: string, description: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-center justify-center h-32 rounded-lg ${type === "dark" ? "bg-slate-800" : "bg-muted"}`}>
          {url ? (
            <Image
              src={url}
              alt={`${title} Logo`}
              width={200}
              height={80}
              style={{
                maxHeight: "80px",
                width: "auto",
                objectFit: "contain",
              }}
            />
          ) : (
            <div className={`text-center ${type === "dark" ? "text-slate-400" : "text-muted-foreground"}`}>
              <ImageIcon className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No logo uploaded</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`logo-${type}`}>Upload New Logo</Label>
          <Input
            id={`logo-${type}`}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={(e) => handleFileSelect(e, type)}
            disabled={isUploading !== null}
          />
        </div>

        {selectedFile?.type === type && previewUrl && (
          <div className="space-y-3">
            <div className={`p-3 border rounded-lg ${type === "dark" ? "bg-slate-800 border-slate-700" : "bg-muted"}`}>
              <p className={`text-xs mb-2 ${type === "dark" ? "text-slate-400" : "text-muted-foreground"}`}>Preview:</p>
              <div className="flex items-center justify-center h-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Logo Preview"
                  style={{
                    maxHeight: "60px",
                    maxWidth: "180px",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleUpload}
                disabled={isUploading !== null}
                className="flex-1"
                size="sm"
              >
                {isUploading === type ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelSelection}
                disabled={isUploading !== null}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      {url && (
        <CardFooter>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(type)}
            disabled={isDeleting !== null}
          >
            {isDeleting === type && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Logo
          </Button>
        </CardFooter>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logo Settings</h1>
        <p className="text-muted-foreground">
          Upload your platform logos for light and dark mode
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderLogoCard(
          "light",
          logoUrl,
          <Sun className="h-5 w-5" />,
          "Light Mode Logo",
          "Displayed when the app is in light mode"
        )}
        {renderLogoCard(
          "dark",
          logoUrlDark,
          <Moon className="h-5 w-5" />,
          "Dark Mode Logo",
          "Displayed when the app is in dark mode"
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tips for Best Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Use a transparent background (PNG or SVG)</li>
            <li>Horizontal logos work best</li>
            <li>Recommended height: 48-100px</li>
            <li>For dark mode, use a light-colored or white logo</li>
            <li>For light mode, use a dark-colored or black logo</li>
            <li>Maximum file size: 2MB</li>
            <li>Supported formats: PNG, JPG, SVG, WebP</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

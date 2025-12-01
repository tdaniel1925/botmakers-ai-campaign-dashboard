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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      // Get image dimensions
      const img = document.createElement("img");
      let calculatedRatio = 1;

      await new Promise<void>((resolve) => {
        img.onload = () => {
          calculatedRatio = img.width / img.height;
          setAspectRatio(calculatedRatio);
          resolve();
        };
        img.src = previewUrl!;
      });

      // Upload via API endpoint (bypasses RLS)
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("aspectRatio", calculatedRatio.toString());

      const response = await fetch("/api/admin/logo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setLogoUrl(result.logoUrl);

      toast({
        title: "Logo uploaded",
        description: "Your logo has been updated successfully",
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
      setIsUploading(false);
    }
  };

  const handleCancelSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch("/api/admin/logo", {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Delete failed");
      }

      setLogoUrl(null);

      toast({
        title: "Logo removed",
        description: "Your logo has been removed",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to remove logo",
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
              <Input
                id="logo"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>

            {previewUrl && (
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                  <div className="flex items-center justify-center h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Logo Preview"
                      style={{
                        maxHeight: "80px",
                        maxWidth: "200px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {isUploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelSelection}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </div>
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

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  Image,
  Video,
  Link as LinkIcon,
  File,
  Download,
  Search,
  Filter,
  ExternalLink,
  Loader2,
  FolderOpen,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string;
  fileSize: number | null;
  thumbnailUrl: string | null;
  downloadCount: number;
  createdAt: string;
  category: Category | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  image: Image,
  video: Video,
  document: File,
  link: LinkIcon,
  other: File,
};

const typeColors: Record<string, string> = {
  pdf: 'bg-red-100 text-red-600',
  image: 'bg-green-100 text-green-600',
  video: 'bg-purple-100 text-purple-600',
  document: 'bg-blue-100 text-blue-600',
  link: 'bg-amber-100 text-amber-600',
  other: 'bg-gray-100 text-gray-600',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    fetchResources();
  }, [categoryFilter, typeFilter, currentPage]);

  const fetchResources = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      if (search) params.set('search', search);
      if (categoryFilter !== 'all') params.set('categoryId', categoryFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const response = await fetch(`/api/sales/resources?${params}`);
      if (!response.ok) throw new Error('Failed to fetch resources');

      const data = await response.json();
      setResources(data.resources);
      setCategories(data.categories);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to load resources');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchResources();
  };

  const handleDownload = async (resource: Resource) => {
    try {
      const response = await fetch(`/api/sales/resources/${resource.id}/download`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to track download');

      const data = await response.json();

      // Open in new tab or download
      if (resource.type === 'link') {
        window.open(data.url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = resource.title;
        a.target = '_blank';
        a.click();
      }

      toast.success('Download started');

      // Update local count
      setResources((prev) =>
        prev.map((r) =>
          r.id === resource.id
            ? { ...r, downloadCount: r.downloadCount + 1 }
            : r
        )
      );
    } catch (error) {
      toast.error('Failed to download resource');
    }
  };

  const getTypeIcon = (type: string) => {
    const Icon = typeIcons[type] || File;
    return <Icon className="h-6 w-6" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Sales Resources</h1>
        <p className="text-muted-foreground">
          Access flyers, documents, videos, and other sales materials
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search resources..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>
            </div>
            <div className="space-y-2">
              <Label className="sr-only">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="sr-only">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : resources.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No resources found</p>
              <p className="text-sm mt-1">
                {search || categoryFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Resources will appear here when added by admins'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => (
              <Card key={resource.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {resource.thumbnailUrl && (
                  <div className="aspect-video relative bg-muted">
                    <img
                      src={resource.thumbnailUrl}
                      alt={resource.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${typeColors[resource.type] || typeColors.other}`}>
                      {getTypeIcon(resource.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{resource.title}</h3>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {resource.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className="capitalize">
                          {resource.type}
                        </Badge>
                        {resource.category && (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: resource.category.color || undefined,
                              color: resource.category.color || undefined,
                            }}
                          >
                            {resource.category.name}
                          </Badge>
                        )}
                        {resource.fileSize && (
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(resource.fileSize)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      {resource.downloadCount} downloads
                    </span>
                    <div className="flex gap-2">
                      {(resource.type === 'image' || resource.type === 'video' || resource.type === 'pdf') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewResource(resource)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(resource)}
                      >
                        {resource.type === 'link' ? (
                          <ExternalLink className="h-4 w-4 mr-1" />
                        ) : (
                          <Download className="h-4 w-4 mr-1" />
                        )}
                        {resource.type === 'link' ? 'Open' : 'Download'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} resources
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewResource} onOpenChange={() => setPreviewResource(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewResource?.title}</DialogTitle>
            {previewResource?.description && (
              <DialogDescription>{previewResource.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="mt-4">
            {previewResource?.type === 'image' && (
              <img
                src={previewResource.url}
                alt={previewResource.title}
                className="w-full max-h-[60vh] object-contain"
              />
            )}
            {previewResource?.type === 'video' && (
              <video
                src={previewResource.url}
                controls
                className="w-full max-h-[60vh]"
              />
            )}
            {previewResource?.type === 'pdf' && (
              <iframe
                src={previewResource.url}
                className="w-full h-[60vh]"
                title={previewResource.title}
              />
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => previewResource && handleDownload(previewResource)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

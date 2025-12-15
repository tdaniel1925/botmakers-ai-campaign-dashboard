'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Eye, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ImpersonationData {
  originalAdminId: string;
  originalAdminEmail: string;
  impersonatedUserId: string;
  impersonatedUserEmail: string;
  impersonatedOrgId: string;
  impersonatedOrgName: string;
  startedAt: string;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    const checkImpersonation = async () => {
      try {
        const response = await fetch('/api/admin/impersonate');
        const result = await response.json();

        if (result.impersonating) {
          setImpersonationData(result.data);
        } else {
          setImpersonationData(null);
        }
      } catch (error) {
        console.error('Failed to check impersonation status:', error);
      }
    };

    checkImpersonation();

    // Check periodically
    const interval = setInterval(checkImpersonation, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEndImpersonation = async () => {
    setIsEnding(true);
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to end impersonation');
      }

      toast.success('Impersonation ended');
      setImpersonationData(null);
      router.push(result.redirectTo || '/admin');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to end impersonation');
    } finally {
      setIsEnding(false);
    }
  };

  if (!impersonationData) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5" />
          <span className="font-medium">
            Viewing as client:
          </span>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="font-semibold">{impersonationData.impersonatedOrgName}</span>
            <span className="text-amber-800">({impersonationData.impersonatedUserEmail})</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-white hover:bg-amber-100 border-amber-600 text-amber-900"
          onClick={handleEndImpersonation}
          disabled={isEnding}
        >
          <X className="mr-2 h-4 w-4" />
          {isEnding ? 'Ending...' : 'Exit Client View'}
        </Button>
      </div>
    </div>
  );
}

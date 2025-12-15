'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Set to false to hide this button in production deployments
const SHOW_DEV_BUTTON = true;

export function DevClientViewButton() {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // Toggle this to hide in production
  if (!SHOW_DEV_BUTTON) {
    return null;
  }

  const handleClick = () => {
    router.push('/dashboard');
  };

  return (
    <Button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-[9999] shadow-xl rounded-full h-14 transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-400"
      style={{
        width: isHovered ? 'auto' : '56px',
        paddingLeft: isHovered ? '16px' : '0',
        paddingRight: isHovered ? '16px' : '0',
      }}
    >
      <Eye className="h-5 w-5" />
      {isHovered && <span className="ml-2 whitespace-nowrap">View Client Dashboard</span>}
    </Button>
  );
}

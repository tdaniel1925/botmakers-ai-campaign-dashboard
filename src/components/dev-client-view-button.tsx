'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DevClientViewButton() {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
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
      className="fixed bottom-6 right-6 z-50 shadow-lg rounded-full h-14 transition-all duration-200"
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

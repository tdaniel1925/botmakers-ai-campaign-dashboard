import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Campaign Portal',
  description: 'AI-powered campaign management and monitoring platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ImpersonationBanner />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

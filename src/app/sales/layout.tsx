import { redirect } from 'next/navigation';
import { requireSalesAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default async function SalesPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const salesUser = await requireSalesAuth();

  return (
    <DashboardLayout userRole="sales" userName={salesUser.fullName}>
      {children}
    </DashboardLayout>
  );
}

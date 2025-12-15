import { redirect } from 'next/navigation';
import { requireFullAuth, checkMustChangePassword } from '@/lib/auth';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireFullAuth();

  // Check if user needs to change password
  const mustChangePassword = await checkMustChangePassword();
  if (mustChangePassword) {
    redirect('/change-password');
  }

  // Check if user is admin
  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <DashboardLayout userRole="admin" userName={user.fullName || undefined}>
      {children}
    </DashboardLayout>
  );
}

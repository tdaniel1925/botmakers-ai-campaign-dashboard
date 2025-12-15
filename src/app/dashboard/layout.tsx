import { redirect } from 'next/navigation';
import { requireFullAuth, checkMustChangePassword } from '@/lib/auth';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';

export default async function ClientDashboardLayout({
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

  // Admins should be redirected to admin dashboard
  if (user.role === 'admin') {
    redirect('/admin');
  }

  // Client users must have an organization
  if (!user.organizationId) {
    redirect('/login?error=no_organization');
  }

  return (
    <DashboardLayout userRole="client_user" userName={user.fullName || undefined}>
      {children}
    </DashboardLayout>
  );
}

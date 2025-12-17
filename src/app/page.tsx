import { redirect } from 'next/navigation';

// Root page - middleware handles the redirect based on auth status
// This page should rarely be reached, but provides a fallback
export default function Home() {
  // Middleware redirects / to /login or /dashboard
  // If somehow reached, redirect to login
  redirect('/login');
}

import { redirect } from 'next/navigation';

/**
 * Root Page
 *
 * Redirects to the receptionist dashboard.
 * The dashboard will handle authentication and redirect to /login if needed.
 */
export default function Home() {
  redirect('/dashboard');
}

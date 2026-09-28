import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserBySessionId, SESSION_COOKIE_NAME, type SessionData } from './session';

/** For server pages: the logged-in receptionist, or a redirect to /login. */
export async function requirePageUser(): Promise<SessionData> {
  const cookieStore = await cookies();
  const user = await getUserBySessionId(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Portfolio-screenshot mode renders the dashboard with mock data and no login.
 * It is ignored in production builds so a stray environment variable cannot
 * expose the dashboard shell on the live site.
 */
export function isScreenshotMode(): boolean {
  return process.env.WASHBOARD_SCREENSHOT_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

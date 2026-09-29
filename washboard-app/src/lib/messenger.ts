// Facebook and Messenger hosts, including their subdomains (www., m., web.).
const MESSENGER_HOSTS = ['m.me', 'fb.me', 'fb.com', 'facebook.com', 'messenger.com'];

/**
 * Turn a stored Messenger handle into a link staff can click, or null if it
 * isn't a Facebook/Messenger address.
 *
 * Handles usually have no protocol: both forms suggest "m.me/name", and the
 * customer booking form stores whatever was typed. So "m.me/juan" becomes
 * https://m.me/juan, while a bare name such as "Juan" stays unlinked rather
 * than guessing at a profile. Any scheme other than http(s) is rejected, so a
 * stored "javascript:..." can never become a link.
 */
export function messengerHref(value: string | null | undefined): string | null {
  const handle = value?.trim();
  if (!handle) return null;

  let candidate: string;
  if (/^https?:\/\//i.test(handle)) {
    candidate = handle;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(handle)) {
    return null;
  } else {
    candidate = `https://${handle}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const allowed = MESSENGER_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  // A bare domain ("facebook.com") names nobody, so it isn't worth a link.
  if (!allowed || url.pathname.length <= 1) return null;

  url.protocol = 'https:';
  return url.toString();
}

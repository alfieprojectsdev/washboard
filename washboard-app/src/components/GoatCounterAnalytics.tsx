'use client';

import { useEffect } from 'react';

// TypeScript declarations for GoatCounter
declare global {
  interface Window {
    goatcounter?: {
      count: (options: {
        path: string;
        title?: string;
        event?: boolean;
        referrer?: string;
      }) => void;
    };
  }
}

export default function GoatCounterAnalytics() {
  // Only load in production
  const code = process.env.NEXT_PUBLIC_GOATCOUNTER_CODE;
  const isProduction = process.env.NODE_ENV === 'production';

  useEffect(() => {
    if (!isProduction || !code) return;

    // Check if script already exists
    if (document.querySelector('script[data-goatcounter]')) return;

    // Inject GoatCounter script
    const script = document.createElement('script');
    script.src = 'https://gc.zgo.at/count.js';
    script.async = true;
    script.setAttribute('data-goatcounter', `https://${code}.goatcounter.com/count`);

    document.body.appendChild(script);

    // Cleanup function
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [code, isProduction]);

  return null;
}

/**
 * Track a custom event in GoatCounter
 * @param name - Event name (e.g., 'booking-submitted', 'qr-code-scanned')
 * @param data - Optional additional data (note: GoatCounter doesn't directly support custom data, but can be encoded in the path)
 */
export function trackEvent(name: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.goatcounter) {
    return;
  }

  try {
    // If data is provided, we can encode it in the path for basic tracking
    const path = data
      ? `/event/${name}?${new URLSearchParams(
          Object.entries(data).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
        ).toString()}`
      : `/event/${name}`;

    window.goatcounter.count({
      path,
      title: name,
      event: true,
    });
  } catch (error) {
    // Silently fail - analytics should not break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('GoatCounter tracking error:', error);
    }
  }
}

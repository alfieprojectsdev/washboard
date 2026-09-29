'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/**
 * A value from the URL fragment, e.g. useHashParam('invite') for
 * /signup#invite=abc. Fragments are never sent to the server, which is why
 * account links carry their tokens there. Returns null during server
 * rendering and hydration, then the real value.
 */
export function useHashParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.hash.slice(1)).get(name),
    () => null
  );
}

'use client'
import { useSyncExternalStore } from 'react';

function subscribe(query: string, callback: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(query: string) {
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string, serverFallback = false) {
  return useSyncExternalStore(
    cb => subscribe(query, cb),
    () => getSnapshot(query),
    () => serverFallback // SSR fallback — domyślnie false (desktop), jak dotąd
  );
}

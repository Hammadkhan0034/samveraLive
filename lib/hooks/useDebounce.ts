import { useState, useEffect } from 'react';

/**
 * Debounce hook to delay value updates
 * @param value - The value to debounce
 * @param delayMs - Delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}


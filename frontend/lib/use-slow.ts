import { useEffect, useState } from 'react';

/** Text shown when a request takes long: Render's free plan sleeps and needs up to a minute to wake up. */
export const WAKING_UP = 'The server is waking up after a quiet period. This can take up to a minute, please wait…';

/** True once `busy` has lasted longer than `ms` (resets when busy ends). */
export function useSlow(busy: boolean, ms = 6000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [busy, ms]);
  return slow;
}

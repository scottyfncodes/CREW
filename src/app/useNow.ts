import { useEffect, useState } from 'react';

/**
 * The current time, re-rendering on an interval.
 *
 * Everything contextual in CREW is a function of "now", so this is the only
 * place a clock ticks. Default cadence is 30s — fast enough for countdowns,
 * slow enough not to wake the phone up.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

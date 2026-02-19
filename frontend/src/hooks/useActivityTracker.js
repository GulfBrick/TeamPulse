import { useEffect, useRef } from 'react';
import { api } from './api';

const PING_INTERVAL = 60_000; // 60 seconds
const IDLE_THRESHOLD = 120_000; // 2 minutes of no activity = idle

/**
 * Tracks mouse/keyboard activity and sends pings to the server.
 * Only runs when the user is clocked in.
 */
export function useActivityTracker(isClockedIn) {
  const lastActivity = useRef(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isClockedIn) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Track user activity
    const onActivity = () => { lastActivity.current = Date.now(); };

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('click', onActivity);
    window.addEventListener('scroll', onActivity);

    // Send pings
    intervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const isActive = idleMs < IDLE_THRESHOLD;

      api.sendPing(isActive, Math.floor(idleMs / 1000)).catch(err => {
        console.warn('Activity ping failed:', err.message);
      });
    }, PING_INTERVAL);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
      window.removeEventListener('scroll', onActivity);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isClockedIn]);
}

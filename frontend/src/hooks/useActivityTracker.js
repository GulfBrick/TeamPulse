import { useEffect, useRef } from 'react';
import { api } from './api';

const PING_INTERVAL = 60_000; // 60 seconds
const IDLE_THRESHOLD = 120_000; // 2 minutes of no activity = idle
const MOUSEMOVE_THROTTLE = 1000; // count at most 1 mousemove per second

/**
 * Tracks mouse/keyboard activity and sends pings to the server.
 * Counts granular events (mouse moves, clicks, keystrokes, scrolls) per ping interval.
 * Only runs when the user is clocked in.
 */
export function useActivityTracker(isClockedIn) {
  const lastActivity = useRef(Date.now());
  const intervalRef = useRef(null);

  // Granular event counters
  const counters = useRef({ mouseMoves: 0, mouseClicks: 0, keystrokes: 0, scrollEvents: 0 });
  const lastMouseMoveTime = useRef(0);

  useEffect(() => {
    if (!isClockedIn) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Reset counters on start
    counters.current = { mouseMoves: 0, mouseClicks: 0, keystrokes: 0, scrollEvents: 0 };

    const onMouseMove = () => {
      lastActivity.current = Date.now();
      // Throttle: only count 1 mousemove per second
      const now = Date.now();
      if (now - lastMouseMoveTime.current >= MOUSEMOVE_THROTTLE) {
        lastMouseMoveTime.current = now;
        counters.current.mouseMoves++;
      }
    };

    const onKeyDown = () => {
      lastActivity.current = Date.now();
      counters.current.keystrokes++;
    };

    const onClick = () => {
      lastActivity.current = Date.now();
      counters.current.mouseClicks++;
    };

    const onScroll = () => {
      lastActivity.current = Date.now();
      counters.current.scrollEvents++;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll);

    // Send pings
    intervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const isActive = idleMs < IDLE_THRESHOLD;

      // Snapshot and reset counters
      const snapshot = { ...counters.current };
      counters.current = { mouseMoves: 0, mouseClicks: 0, keystrokes: 0, scrollEvents: 0 };

      api.sendPing(isActive, Math.floor(idleMs / 1000), snapshot).catch(err => {
        console.warn('Activity ping failed:', err.message);
      });
    }, PING_INTERVAL);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isClockedIn]);
}

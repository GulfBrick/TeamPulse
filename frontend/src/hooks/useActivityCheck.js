import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './api';

const MIN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_INTERVAL = 20 * 60 * 1000; // 20 minutes
const RESPONSE_TIMEOUT = 60; // seconds

function randomInterval() {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

export function useActivityCheck(isClockedIn) {
  const [showCheck, setShowCheck] = useState(false);
  const [countdown, setCountdown] = useState(RESPONSE_TIMEOUT);
  const [wasAutoClocked, setWasAutoClocked] = useState(false);

  const checkTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const scheduleCheck = useCallback(() => {
    clearAllTimers();
    const delay = randomInterval();
    checkTimerRef.current = setTimeout(() => {
      setShowCheck(true);
      setCountdown(RESPONSE_TIMEOUT);
    }, delay);
  }, [clearAllTimers]);

  // Start countdown when check is shown
  useEffect(() => {
    if (!showCheck) return;

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Time's up — auto clock out
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          setShowCheck(false);
          api.clockOut().catch(() => {});
          setWasAutoClocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [showCheck]);

  // Schedule check when clocked in, clear when clocked out
  useEffect(() => {
    if (isClockedIn) {
      setWasAutoClocked(false);
      scheduleCheck();
    } else {
      clearAllTimers();
      setShowCheck(false);
    }
    return clearAllTimers;
  }, [isClockedIn, scheduleCheck, clearAllTimers]);

  const confirmPresence = useCallback(() => {
    setShowCheck(false);
    setCountdown(RESPONSE_TIMEOUT);
    scheduleCheck();
  }, [scheduleCheck]);

  const dismissAutoClockMessage = useCallback(() => {
    setWasAutoClocked(false);
  }, []);

  return {
    showCheck,
    countdown,
    confirmPresence,
    wasAutoClocked,
    dismissAutoClockMessage,
  };
}

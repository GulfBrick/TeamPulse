import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './api';

const MIN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_INTERVAL = 20 * 60 * 1000; // 20 minutes
const RESPONSE_TIMEOUT = 60; // seconds

function randomInterval() {
  return MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendSystemNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  try {
    const notification = new Notification('TeamPulse — Are you still working?', {
      body: 'Click to confirm your presence. You have 60 seconds.',
      icon: '/logo.png',
      requireInteraction: true,
      tag: 'teampulse-activity-check', // replaces previous notification if still shown
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch {
    return null;
  }
}

export function useActivityCheck(isClockedIn) {
  const [showCheck, setShowCheck] = useState(false);
  const [countdown, setCountdown] = useState(RESPONSE_TIMEOUT);
  const [wasAutoClocked, setWasAutoClocked] = useState(false);

  const checkTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const notificationRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Close any open system notification
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
  }, []);

  const scheduleCheck = useCallback(() => {
    clearAllTimers();
    const delay = randomInterval();
    checkTimerRef.current = setTimeout(() => {
      setShowCheck(true);
      setCountdown(RESPONSE_TIMEOUT);
      // Send system notification so it appears over other apps
      notificationRef.current = sendSystemNotification();
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
          if (notificationRef.current) {
            notificationRef.current.close();
            notificationRef.current = null;
          }
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

  // Request notification permission when clocked in; schedule checks
  useEffect(() => {
    if (isClockedIn) {
      setWasAutoClocked(false);
      requestNotificationPermission();
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
    // Close system notification on confirm
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
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

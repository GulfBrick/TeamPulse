/**
 * Tracks the currently active window (app name + title).
 * Uses the `active-win` package for system-wide window detection.
 */

let activeWin;
try {
  activeWin = require('active-win');
} catch (err) {
  console.error('active-win failed to load:', err.message);
  activeWin = null;
}

class WindowTracker {
  constructor() {
    this._current = { app: '', title: '' };
    this._history = []; // track app switches
    this._interval = null;
  }

  start() {
    if (this._interval) return;

    const poll = async () => {
      try {
        if (!activeWin) return;
        const win = await activeWin();
        if (win) {
          const app = win.owner?.name || '';
          const title = win.title || '';

          // Track app change
          if (app !== this._current.app) {
            this._history.push({
              app,
              title,
              timestamp: new Date().toISOString(),
            });
            // Keep last 100 entries
            if (this._history.length > 100) this._history.shift();
          }

          this._current = { app, title };
        }
      } catch {
        // ignore polling errors
      }
    };

    poll(); // immediate first read
    this._interval = setInterval(poll, 2000); // poll every 2 seconds
  }

  getCurrent() {
    return { ...this._current };
  }

  /** Returns recent app switches and clears the history */
  flushHistory() {
    const history = [...this._history];
    this._history = [];
    return history;
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}

module.exports = { WindowTracker };
